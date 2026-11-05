import { Runtime } from "foldkit";
import "./app.css";
import { AppModelSchema, init, update, view } from "./app";

const application = Runtime.makeApplication({
  Model: AppModelSchema,
  init,
  update,
  view,
  container: document.getElementById("app"),
});
Runtime.run(application);