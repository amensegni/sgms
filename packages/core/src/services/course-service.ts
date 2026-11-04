import { Context, Effect, Layer } from "effect";
import {
  Course,
  DuplicateCourse,
  PersistenceError,
} from "../contracts.js";
import { CourseRepository } from "./repositories.js";

export class CourseService extends Context.Service<
  CourseService,
  {
    create: (input: { name: string; code: string }) => Effect.Effect<Course, DuplicateCourse | PersistenceError>;
    list: () => Effect.Effect<readonly Course[], PersistenceError>;
  }
>()("CourseService") {}

export const CourseServiceLayer = Layer.effect(
  CourseService,
  Effect.gen(function* () {
    const repository = yield* CourseRepository;
    return {
      create: (input: { name: string; code: string }) =>
        repository.create({
          name: input.name.trim(),
          code: input.code.trim().toUpperCase(),
        }),
      list: () => repository.list(),
    };
  })
);
