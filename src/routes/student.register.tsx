import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { TSUHeader } from "@/components/TSUHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Upload, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  validateRegistrationToken,
  registerStudentWithToken,
  listFacultiesAndDepartments,
} from "@/lib/student-registration.functions";

const searchSchema = z.object({ token: z.string().optional() });

export const Route = createFileRoute("/student/register")({
  head: () => ({ meta: [{ title: "Student Registration — SCOE" }] }),
  validateSearch: searchSchema,
  component: StudentRegisterPage,
});

type Faculty = { id: string; name: string; code: string | null };
type Department = { id: string; name: string; code: string | null; faculty_id: string };

function StudentRegisterPage() {
  const { token } = useSearch({ from: "/student/register" });
  const navigate = useNavigate();
  const validate = useServerFn(validateRegistrationToken);
  const register = useServerFn(registerStudentWithToken);
  const listOpts = useServerFn(listFacultiesAndDepartments);

  const [loadingToken, setLoadingToken] = useState(true);
  const [linkLabel, setLinkLabel] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  const [facultyId, setFacultyId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [level, setLevel] = useState("100");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState<"Male" | "Female" | "Other" | "">("");
  const [dob, setDob] = useState("");
  const [address, setAddress] = useState("");
  const [state, setState] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [passportBase64, setPassportBase64] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ matric: string; email: string } | null>(null);

  const filteredDepartments = useMemo(
    () => departments.filter((d) => d.faculty_id === facultyId),
    [departments, facultyId],
  );

  useEffect(() => {
    if (!token) {
      setTokenError("This page requires a valid registration link.");
      setLoadingToken(false);
      return;
    }
    Promise.all([validate({ data: { token } }), listOpts()])
      .then(([res, opts]) => {
        if (res.valid) {
          setLinkLabel(res.link.label ?? null);
          setFaculties(opts.faculties);
          setDepartments(opts.departments);
        } else {
          setTokenError(res.reason);
        }
      })
      .catch((e) => setTokenError((e as Error).message))
      .finally(() => setLoadingToken(false));
  }, [token, validate, listOpts]);

  const handlePassport = (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Passport must be under 2MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPassportBase64(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!facultyId || !departmentId) {
      toast.error("Please select your faculty and department");
      return;
    }
    setSubmitting(true);
    try {
      const res = await register({
        data: {
          token,
          faculty_id: facultyId,
          department_id: departmentId,
          level: Number(level),
          full_name: fullName,
          email,
          password,
          phone: phone || null,
          gender: gender || null,
          date_of_birth: dob || null,
          address: address || null,
          state_of_origin: state || null,
          guardian_name: guardianName || null,
          guardian_phone: guardianPhone || null,
          passport_base64: passportBase64,
        },
      });
      setSuccess({ matric: res.matric_number, email: res.email });
      toast.success("Registration complete!");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingToken) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <TSUHeader />
        <div className="flex flex-1 items-center justify-center px-4 py-10">
          <Card className="w-full max-w-md tsu-shadow">
            <CardHeader className="text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
              <CardTitle className="font-serif text-2xl">Welcome!</CardTitle>
              <CardDescription>Your student account has been created.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md bg-secondary p-4">
                <p className="text-xs text-muted-foreground">Your matric number</p>
                <p className="font-mono text-lg font-bold">{success.matric}</p>
                <p className="mt-2 text-xs text-muted-foreground">Sign in using this matric number and your password.</p>
              </div>
              <Button className="w-full" onClick={() => navigate({ to: "/student/login" })}>Go to Sign In</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (tokenError) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <TSUHeader />
        <div className="flex flex-1 items-center justify-center px-4 py-10">
          <Card className="w-full max-w-md tsu-shadow">
            <CardHeader>
              <CardTitle className="font-serif text-2xl">Invalid Link</CardTitle>
              <CardDescription>{tokenError}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Please contact the Registrar for a new registration link.</p>
              <Link to="/student/login" className="mt-4 inline-block text-sm text-primary underline">Already registered? Sign in →</Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TSUHeader />
      <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <Card className="tsu-shadow">
          <CardHeader>
            <CardTitle className="font-serif text-2xl">Student Registration</CardTitle>
            <CardDescription>
              {linkLabel ? `${linkLabel} • ` : ""}Fill in your details. After saving, your record will be filed under the faculty and department you select.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20 border">
                  <AvatarImage src={passportBase64 ?? undefined} />
                  <AvatarFallback>Passport</AvatarFallback>
                </Avatar>
                <Label htmlFor="passport" className="cursor-pointer">
                  <div className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent">
                    <Upload className="h-4 w-4" /> Upload Passport
                  </div>
                  <Input
                    id="passport"
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => e.target.files?.[0] && handlePassport(e.target.files[0])}
                  />
                </Label>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Faculty *</Label>
                  <Select value={facultyId} onValueChange={(v) => { setFacultyId(v); setDepartmentId(""); }}>
                    <SelectTrigger><SelectValue placeholder="Select faculty" /></SelectTrigger>
                    <SelectContent>{faculties.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Department *</Label>
                  <Select value={departmentId} onValueChange={setDepartmentId} disabled={!facultyId}>
                    <SelectTrigger><SelectValue placeholder={facultyId ? "Select department" : "Pick faculty first"} /></SelectTrigger>
                    <SelectContent>{filteredDepartments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Level *</Label>
                  <Select value={level} onValueChange={setLevel}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{[100,200,300,400,500].map((l) => <SelectItem key={l} value={String(l)}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5 md:col-span-2">
                  <Label>Full Name *</Label>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Email *</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Password *</Label>
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Gender</Label>
                  <Select value={gender} onValueChange={(v) => setGender(v as "Male" | "Female" | "Other")}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Date of Birth</Label>
                  <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>State of Origin</Label>
                  <Input value={state} onChange={(e) => setState(e.target.value)} />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label>Address</Label>
                  <Input value={address} onChange={(e) => setAddress(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Guardian Name</Label>
                  <Input value={guardianName} onChange={(e) => setGuardianName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Guardian Phone</Label>
                  <Input value={guardianPhone} onChange={(e) => setGuardianPhone(e.target.value)} />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating account…</> : "Complete Registration"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
