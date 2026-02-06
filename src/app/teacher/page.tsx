import { redirect } from "next/navigation";

export default async function TeacherHome() {
  redirect("/teacher/assessments");
}
