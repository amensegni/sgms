import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { Layer, ManagedRuntime, Schema } from "effect";
import {
  CourseNotFound,
  DuplicateCourse,
  DuplicateStudent,
  InvalidGrade,
  PersistenceError,
  StudentNotFound,
  createCourse,
  createCourseContract,
  createStudent,
  createStudentContract,
  getGradesForStudent,
  getGradesForStudentContract,
  listCourses,
  listStudents,
  recordGrade,
  recordGradeContract,
  listCoursesContract,
  listStudentsContract,
  StudentServiceLayer,
  CourseServiceLayer,
  GradeServiceLayer,
} from "@sgms/core";
import { makePrismaRepositoryLayer } from "./database.js";

const databaseUrl = process.env.DATABASE_URL ?? "file:./dev.sqlite";
const port = Number(process.env.PORT ?? 3000);
const webRoot = resolve(process.cwd(), "apps/web/dist");
const repositories = makePrismaRepositoryLayer(databaseUrl);
const applicationLayer = Layer.mergeAll(
  StudentServiceLayer,
  CourseServiceLayer,
  GradeServiceLayer
).pipe(Layer.provideMerge(repositories.layer));
const runtime = ManagedRuntime.make(applicationLayer);

class InvalidRequestError extends Error {}

const mimeTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
};

const sendJson = (response: ServerResponse, status: number, body: unknown) => {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
};

const readJson = async (request: IncomingMessage): Promise<unknown> => {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += data.length;
    if (size > 1_000_000) {
      throw new RangeError("Request body exceeds 1 MB");
    }
    chunks.push(data);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
};

const decodeRequest = <S extends Schema.ConstraintDecoder<unknown>>(
  schema: S,
  value: unknown
): S["Type"] => {
  try {
    return Schema.decodeUnknownSync(schema)(value);
  } catch {
    throw new InvalidRequestError();
  }
};

const handleFailure = (response: ServerResponse, cause: unknown) => {
  if (cause instanceof DuplicateStudent || cause instanceof DuplicateCourse) {
    sendJson(response, 409, { error: cause._tag });
    return;
  }
  if (cause instanceof StudentNotFound || cause instanceof CourseNotFound) {
    sendJson(response, 404, { error: cause._tag });
    return;
  }
  if (cause instanceof InvalidGrade) {
    sendJson(response, 400, { error: cause._tag, message: cause.reason });
    return;
  }
  if (cause instanceof PersistenceError) {
    console.error(`${cause.operation}: ${cause.message}`);
    sendJson(response, 500, { error: "PersistenceError" });
    return;
  }
  console.error("Unhandled API request failure", cause);
  sendJson(response, 500, { error: "InternalServerError" });
};

const handleApi = async (request: IncomingMessage, response: ServerResponse) => {
  const method = request.method ?? "GET";
  const url = new URL(request.url ?? "/", "http://localhost");

  try {
    if (method === "GET" && url.pathname === "/api/students") {
      const input = decodeRequest(listStudentsContract.input, {});
      const students = await runtime.runPromise(listStudents.handler(input));
      sendJson(response, 200, students);
      return;
    }
    if (method === "POST" && url.pathname === "/api/students") {
      const input = decodeRequest(createStudentContract.input, await readJson(request));
      const student = await runtime.runPromise(createStudent.handler(input));
      sendJson(response, 201, student);
      return;
    }
    if (method === "GET" && url.pathname === "/api/courses") {
      const input = decodeRequest(listCoursesContract.input, {});
      const courses = await runtime.runPromise(listCourses.handler(input));
      sendJson(response, 200, courses);
      return;
    }
    if (method === "POST" && url.pathname === "/api/courses") {
      const input = decodeRequest(createCourseContract.input, await readJson(request));
      const course = await runtime.runPromise(createCourse.handler(input));
      sendJson(response, 201, course);
      return;
    }
    const gradesMatch = /^\/api\/students\/([^/]+)\/grades$/.exec(url.pathname);
    if (method === "GET" && gradesMatch) {
      const input = decodeRequest(getGradesForStudentContract.input, {
        studentId: decodeURIComponent(gradesMatch[1]!),
      });
      const grades = await runtime.runPromise(getGradesForStudent.handler(input));
      sendJson(response, 200, grades);
      return;
    }
    if (method === "POST" && url.pathname === "/api/grades") {
      const input = decodeRequest(recordGradeContract.input, await readJson(request));
      const grade = await runtime.runPromise(recordGrade.handler(input));
      sendJson(response, 201, grade);
      return;
    }
    sendJson(response, 404, { error: "NotFound" });
  } catch (cause) {
    if (cause instanceof SyntaxError || cause instanceof InvalidRequestError) {
      sendJson(response, 400, { error: "InvalidRequest" });
      return;
    }
    if (cause instanceof RangeError) {
      sendJson(response, 413, { error: "RequestTooLarge" });
      return;
    }
    handleFailure(response, cause);
  }
};

const serveFile = async (request: IncomingMessage, response: ServerResponse) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { allow: "GET, HEAD" });
    response.end();
    return;
  }

  const urlPath = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
  const requestedPath = urlPath === "/" ? "/index.html" : urlPath;
  const path = resolve(webRoot, `.${requestedPath}`);
  if (path !== webRoot && !path.startsWith(`${webRoot}${sep}`)) {
    response.writeHead(400);
    response.end();
    return;
  }

  try {
    const file = (await stat(path)).isFile() ? path : resolve(webRoot, "index.html");
    const contents = await readFile(file);
    response.writeHead(200, {
      "content-type": mimeTypes[extname(file)] ?? "application/octet-stream",
      "content-length": contents.byteLength,
    });
    response.end(request.method === "HEAD" ? undefined : contents);
  } catch (cause) {
    if (cause instanceof Error && "code" in cause && cause.code === "ENOENT") {
      response.writeHead(404);
      response.end();
      return;
    }
    throw cause;
  }
};

const server = createServer((request, response) => {
  if (request.url?.startsWith("/api/")) {
    void handleApi(request, response);
    return;
  }
  void serveFile(request, response).catch((cause: unknown) => {
    console.error("Static file request failed", cause);
    if (!response.headersSent) {
      response.writeHead(500);
    }
    response.end();
  });
});

server.listen(port, () => {
  console.info(`SGMS listening on port ${port}`);
});

const shutdown = async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
  await runtime.dispose();
  await repositories.close();
};

const handleShutdown = () => {
  void shutdown().catch((cause: unknown) => {
    console.error("API shutdown failed", cause);
    process.exitCode = 1;
  });
};

process.once("SIGINT", handleShutdown);
process.once("SIGTERM", handleShutdown);
