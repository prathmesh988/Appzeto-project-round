import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Sparkles, ArrowRight, ShieldCheck } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useOrgStore } from "@/stores/orgStore";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const DEMO_USERS = [
  { name: "Alice", email: "demo-alice@example.com", role: "OWNER (Acme)" },
  { name: "Bob", email: "demo-bob@example.com", role: "ADMIN (Acme)" },
  { name: "Carol", email: "demo-carol@example.com", role: "MEMBER (Acme)" },
  { name: "Dave", email: "demo-dave@example.com", role: "VIEWER (Acme)" },
  { name: "Eve", email: "demo-eve@example.com", role: "MEMBER (Multi-Org)" },
];

export function LoginPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const { clearActiveOrg } = useOrgStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    try {
      setLoading(true);
      setError(null);
      const res = await api.post("/auth/login", { email, password });
      if (res.data.success) {
        clearActiveOrg(); // Allow org switcher to pick new user's orgs
        const user = res.data.user || res.data.data?.user;
        const token = res.data.token || res.data.data?.token;
        setAuth(user, token);
        navigate("/");
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword("Demo1234!");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Brand header */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md">
            <Sparkles className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Welcome back</h1>
          <p className="text-xs text-muted-foreground">
            Sign in to your multi-tenant project management workspace
          </p>
        </div>

        <Card className="border-border shadow-lg">
          <form onSubmit={handleSubmit}>
            <CardHeader className="space-y-1">
              <CardTitle className="text-lg">Sign in</CardTitle>
              <CardDescription className="text-xs">
                Enter your credentials or choose a demo persona below
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <div className="rounded-md bg-destructive/15 p-2.5 text-xs font-medium text-destructive">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-semibold">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs font-semibold">Password</Label>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <Button type="submit" className="w-full font-semibold" disabled={loading}>
                {loading ? "Signing in..." : "Sign in"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>

            <CardFooter className="flex flex-col border-t pt-4">
              <p className="text-xs text-muted-foreground text-center">
                Don't have an account?{" "}
                <Link to="/register" className="font-semibold text-primary hover:underline">
                  Create account
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>

        {/* Demo persona quick switcher */}
        <div className="rounded-lg border border-border/80 bg-card p-3 shadow-xs">
          <div className="flex items-center gap-1.5 mb-2 px-1 text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              Quick Test Personas (pw: Demo1234!)
            </span>
          </div>
          <div className="grid grid-cols-1 gap-1.5">
            {DEMO_USERS.map((u) => (
              <button
                key={u.email}
                type="button"
                onClick={() => handleQuickLogin(u.email)}
                className="flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs hover:bg-muted/70 transition-colors text-left border border-border/40"
              >
                <span className="font-medium text-foreground">{u.name}</span>
                <span className="text-muted-foreground text-[11px] font-mono">{u.email}</span>
                <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                  {u.role}
                </Badge>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
