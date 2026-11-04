import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { Effect, Layer } from "effect";
import { expect } from "vitest";
import { it } from "@effect/vitest";
import {
  CourseService,
  CourseServiceLayer,
  GradeService,
  GradeServiceLayer,
  StudentService,
  StudentServiceLayer,
} from "@sgms/core";
import { makePrismaRepositoryLayer } from "../src/database.js";

const execFileAsync = promisify(execFile);
const projectRoot = resolve(import.meta.dirname, "../../..");

const withMigratedSqlite = <A, E>(
  use: (url: string) => Effect.Effect<A, E>
): Effect.Effect<A, E | Error> =>
  Effect.acquireUseRelease(
    Effect.tryPromise({
      try: async () => {
        const directory = await mkdtemp(join(tmpdir(), "sgms-db-test-"));
        const url = `file:${join(directory, "test.sqlite")}`;
        try {
          await execFileAsync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
            cwd: projectRoot,
            env: { ...process.env, DATABASE_URL: url },
          });
        } catch (cause) {
          await rm(directory, { recursive: true, force: true });
          throw cause;
        }
        return { directory, url };
      },
      catch: (cause) => cause instanceof Error ? cause : new Error(String(cause)),
    }),
    ({ url }) => use(url),
    ({ directory }) => Effect.promise(() => rm(directory, { recursive: true, force: true }))
  );

it.effect("persists capability service writes through Prisma and SQLite", () =>
  withMigratedSqlite((url) => {
    const repositories = makePrismaRepositoryLayer(url);
    const applicationLayer = Layer.mergeAll(
      StudentServiceLayer,
      CourseServiceLayer,
      GradeServiceLayer
    ).pipe(Layer.provideMerge(repositories.layer));

    const exerciseDatabase = Effect.gen(function* () {
      const studentService = yield* StudentService;
      const courseService = yield* CourseService;
      const gradeService = yield* GradeService;
      const student = yield* studentService.create({
        name: "Persisted student",
        email: "persisted@example.com",
      });
      const course = yield* courseService.create({
        name: "Persistence",
        code: "persist101",
      });
      const grade = yield* gradeService.record({
        studentId: student.id,
        courseId: course.id,
        value: 88,
      });

      expect((yield* studentService.list()).map((item) => item.email)).toEqual([
        "persisted@example.com",
      ]);
      expect((yield* courseService.list()).map((item) => item.code)).toEqual([
        "PERSIST101",
      ]);
      expect(yield* gradeService.getForStudent({ studentId: student.id })).toEqual([
        grade,
      ]);
    }).pipe(Effect.provide(applicationLayer));

    return Effect.acquireUseRelease(
      Effect.succeed(repositories),
      () => exerciseDatabase,
      (database) => Effect.promise(() => database.close())
    );
  }),
  15_000
);
