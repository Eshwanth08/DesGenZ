import LoginForm from "./LoginForm";
import ThemeToggle from "@/components/ThemeToggle";

export const metadata = { title: "DesGenZ — Sign in" };

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <LoginForm />
    </main>
  );
}
