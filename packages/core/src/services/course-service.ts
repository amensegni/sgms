import { Context, Effect, Layer } from "effect";
import {
  createCourseContract,
  CourseNotFound,
  Course,
  CourseId,
} from "../contracts";

class CourseService extends Context.Service("CourseService")() {
  create = (input: { name: string; code: string }) =>
    Effect.gen(function* () {
      const courses = yield* CourseStore;
      const existing = yield* Effect.promise(() =>
        courses.find((c) => c.code === input.code)
      );
      if (existing) {
        yield* Effect.fail(new CourseNotFound({ id: input.code }));
      }
      const id: CourseId = crypto.randomUUID();
      const course: Course = { id, name: input.name, code: input.code };
      yield* Effect.promise(() => courses.push(course));
      return course;
    });
}

class CourseStore extends Context.Tag("CourseStore")<
  CourseStore,
  { items: Course[]; find: (pred: (c: Course) => unknown) => Promise<Course | undefined>; push: (c: Course) => Promise<void> }
>() {}

export const CourseServiceLayer = Layer.effect(
  CourseService,
  Effect.gen(function* () {
    const store = yield* CourseStore;
    return new CourseService({ store });
  })
);

export const CourseStoreLayer = Layer.succeed(
  CourseStore,
  {
    items: [],
    find: (pred) => Promise.resolve(([] as Course[]).find(pred)),
    push: (c) => Promise.resolve(),
  }
);