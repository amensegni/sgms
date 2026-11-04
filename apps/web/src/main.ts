import { Runtime } from "@effect/platform-browser";
import { program } from "./app";

const runtime = Runtime.make();
Runtime.runMain(runtime)(program);