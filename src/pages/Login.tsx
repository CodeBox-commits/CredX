import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Building2, UserCog } from "lucide-react";

const Login = () => {
  const navigate = useNavigate();
  const [activeRole, setActiveRole] = useState("borrower");

  const handleSignIn = () => {
    if (activeRole === "manager") {
      navigate("/dashboard");
      return;
    }
    navigate("/document-analyzer");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-[520px]">
        <div className="mb-7 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-blue-900">IntelliCredit AI</h1>
          <p className="mt-2 text-sm font-medium text-blue-900">Secure Corporate Credit Evaluation Portal</p>
        </div>

        <Card className="border-slate-200 bg-white shadow-md">
          <CardHeader className="px-8 pb-4 pt-8">
            <CardTitle className="text-2xl font-bold text-blue-900">Sign In</CardTitle>
            <CardDescription className="text-blue-900">
              Choose your access mode to continue
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 px-8 pb-8">
            <Tabs value={activeRole} onValueChange={setActiveRole}>
              <TabsList className="grid h-11 w-full grid-cols-2 bg-slate-100 p-1">
                <TabsTrigger value="borrower" className="font-semibold data-[state=active]:text-blue-900">
                  <Building2 className="mr-1.5 h-4 w-4" />
                  Corporate Borrower
                </TabsTrigger>
                <TabsTrigger value="manager" className="font-semibold data-[state=active]:text-blue-900">
                  <UserCog className="mr-1.5 h-4 w-4" />
                  Credit Manager
                </TabsTrigger>
              </TabsList>

              <TabsContent value="borrower" className="space-y-4 pt-4">
                <div className="space-y-1.5">
                  <Label htmlFor="borrower-email" className="text-sm font-semibold text-blue-900">Email</Label>
                  <Input id="borrower-email" type="email" placeholder="borrower@company.com" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="borrower-password" className="text-sm font-semibold text-blue-900">Password</Label>
                  <Input id="borrower-password" type="password" placeholder="Enter password" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="borrower-cin" className="text-sm font-semibold text-blue-900">Company CIN</Label>
                  <Input id="borrower-cin" placeholder="L40106GJ1996PLC030533" />
                </div>
              </TabsContent>

              <TabsContent value="manager" className="space-y-4 pt-4">
                <div className="space-y-1.5">
                  <Label htmlFor="manager-email" className="text-sm font-semibold text-blue-900">Email</Label>
                  <Input id="manager-email" type="email" placeholder="credit.manager@bank.com" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="manager-password" className="text-sm font-semibold text-blue-900">Password</Label>
                  <Input id="manager-password" type="password" placeholder="Enter password" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="manager-cin" className="text-sm font-semibold text-blue-900">Company Registration Number</Label>
                  <Input id="manager-cin" placeholder="L40106GJ1996PLC030533" />
                </div>
              </TabsContent>
            </Tabs>

            <Button className="h-11 w-full bg-blue-900 text-sm font-semibold text-white hover:bg-blue-800" onClick={handleSignIn}>
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;
