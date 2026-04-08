import { SignIn } from "@clerk/nextjs";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[rgb(7,17,31)] px-6">
      <div
        className="absolute inset-0 opacity-20"
        style={{
          background: "radial-gradient(ellipse 60% 50% at 50% 30%, rgba(77,163,255,0.18), transparent)",
        }}
      />
      <div className="relative">
        <SignIn
          appearance={{
            variables: {
              colorPrimary: "#4DA3FF",
              colorBackground: "#0B1526",
              colorText: "#F5F7FB",
              colorTextSecondary: "rgba(245,247,251,0.6)",
              colorInputBackground: "rgba(255,255,255,0.06)",
              colorInputText: "#F5F7FB",
              borderRadius: "14px",
              fontFamily: "Inter, system-ui, sans-serif",
            },
          }}
        />
      </div>
    </div>
  );
}
