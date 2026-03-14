import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { Calendar as CalendarIcon, ArrowLeft, Trash2 } from "lucide-react";

import { db, type TransactionType, type TransactionSource } from "../db";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const formSchema = z.object({
    title: z.string().min(2, "Title must be at least 2 characters").max(50),
    amount: z.coerce.number().positive("Amount must be greater than zero"),
    type: z.enum(["debit", "credit", "lend", "borrowed"]),
    source: z.string().min(1, "Please select a source account"),
    category: z.enum(["Need", "Want", "Other"]).optional(),
    timestamp: z.date(),
});

export function TransactionForm() {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEditing = !!id;
    const [loadError, setLoadError] = useState("");

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema) as any,
        defaultValues: {
            title: "",
            amount: 0,
            type: "debit",
            source: "",
            category: "Need",
            timestamp: new Date(),
        },
    });

    useEffect(() => {
        async function loadTransaction() {
            if (!isEditing) return;
            try {
                const tx = await db.transactions.get(Number(id));
                if (tx) {
                    form.reset({
                        title: tx.title,
                        amount: Math.abs(tx.amount), // Form shows positive, submission handles sign
                        type: tx.type,
                        source: tx.source,
                        category: tx.category || "Need",
                        timestamp: new Date(tx.timestamp),
                    });
                } else {
                    setLoadError("Transaction not found");
                }
            } catch (e) {
                setLoadError("Failed to load transaction");
            }
        }
        loadTransaction();
    }, [id, isEditing, form]);

    async function onSubmit(values: z.infer<typeof formSchema>) {
        // Determine the actual signed amount based on type
        let finalAmount = values.amount;
        if (values.type === 'debit' || values.type === 'borrowed') {
            finalAmount = -Math.abs(values.amount);
        }

        const transactionData = {
            title: values.title,
            amount: finalAmount,
            type: values.type as TransactionType,
            source: values.source as TransactionSource,
            category: values.category as "Need" | "Want" | "Other" | undefined,
            timestamp: values.timestamp.toISOString(),
        };

        try {
            if (isEditing) {
                await db.transactions.update(Number(id), transactionData);
            } else {
                await db.transactions.add(transactionData);
            }
            navigate("/");
        } catch (e) {
            console.error("Failed to save transaction", e);
            alert("Failed to save transaction.");
        }
    }

    async function handleDelete() {
        if (!isEditing) return;
        if (window.confirm("Are you sure you want to delete this entry?")) {
            await db.transactions.delete(Number(id));
            navigate("/");
        }
    }

    const accounts = useLiveQuery(() => db.accounts.toArray());

    if (loadError) return <div className="p-8 text-red-500">{loadError}</div>;
    // We optionally can wait for accounts to load to ensure dropdown isn't empty on fast loads
    if (accounts === undefined) return <div className="p-8 text-zinc-400">Loading form...</div>;

    return (
        <div className="p-4 md:p-8 animate-in slide-in-from-bottom-4 duration-300">
            <Button variant="ghost" className="mb-4 text-zinc-400 hover:text-zinc-50" onClick={() => navigate(-1)}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
            </Button>

            <Card className="max-w-xl mx-auto bg-zinc-900 border-zinc-800 text-zinc-50">
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-2xl">{isEditing ? "Edit Entry" : "New Entry"}</CardTitle>
                        <CardDescription className="text-zinc-400">Log a new financial transaction offline.</CardDescription>
                    </div>
                    {isEditing && (
                        <Button variant="destructive" size="icon" onClick={handleDelete}>
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    )}
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <FormField
                                control={form.control}
                                name="title"
                                render={({ field }: { field: any }) => (
                                    <FormItem>
                                        <FormLabel>Description / Title</FormLabel>
                                        <FormControl>
                                            <Input placeholder="e.g. Weekly Groceries" className="bg-zinc-950 border-zinc-800 focus-visible:ring-emerald-500" {...field} />
                                        </FormControl>
                                        <FormMessage className="text-rose-500" />
                                    </FormItem>
                                )}
                            />

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="amount"
                                    render={({ field }: { field: any }) => (
                                        <FormItem>
                                            <FormLabel>Amount</FormLabel>
                                            <FormControl>
                                                <Input type="number" step="0.01" min="0" placeholder="0.00" className="bg-zinc-950 border-zinc-800 focus-visible:ring-emerald-500" {...field} />
                                            </FormControl>
                                            <FormMessage className="text-rose-500" />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="timestamp"
                                    render={({ field }: { field: any }) => (
                                        <FormItem className="flex flex-col pt-2.5">
                                            <FormLabel>Date</FormLabel>
                                            <Popover>
                                                <PopoverTrigger>
                                                    <div>
                                                        <FormControl>
                                                            <Button
                                                                variant={"outline"}
                                                                className={cn(
                                                                    "w-full pl-3 text-left font-normal bg-zinc-950 border-zinc-800 hover:bg-zinc-800 hover:text-zinc-50 text-zinc-300",
                                                                    !field.value && "text-muted-foreground"
                                                                )}
                                                            >
                                                                {field.value ? (
                                                                    format(field.value, "PPP")
                                                                ) : (
                                                                    <span>Pick a date</span>
                                                                )}
                                                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                            </Button>
                                                        </FormControl>
                                                    </div>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0 bg-zinc-900 border-zinc-800" align="start">
                                                    <Calendar
                                                        mode="single"
                                                        selected={field.value}
                                                        onSelect={field.onChange}
                                                        disabled={(date) =>
                                                            date > new Date() || date < new Date("1900-01-01")
                                                        }
                                                        initialFocus
                                                        className="text-zinc-50"
                                                    />
                                                </PopoverContent>
                                            </Popover>
                                            <FormMessage className="text-rose-500" />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="type"
                                    render={({ field }: { field: any }) => (
                                        <FormItem>
                                            <FormLabel>Type</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger className="bg-zinc-950 border-zinc-800 text-zinc-300 focus:ring-emerald-500">
                                                        <SelectValue placeholder="Select type" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-50">
                                                    <SelectItem value="debit">Debit (Expense)</SelectItem>
                                                    <SelectItem value="credit">Credit (Income)</SelectItem>
                                                    <SelectItem value="lend">Lend</SelectItem>
                                                    <SelectItem value="borrowed">Borrowed</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage className="text-rose-500" />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="source"
                                    render={({ field }: { field: any }) => (
                                        <FormItem>
                                            <FormLabel>Source Account</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger className="bg-zinc-950 border-zinc-800 text-zinc-300 focus:ring-emerald-500">
                                                        <SelectValue placeholder="Select source" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-50">
                                                    {accounts?.map((acc: any) => (
                                                        <SelectItem key={acc.id} value={acc.name}>{acc.name}</SelectItem>
                                                    ))}
                                                    {accounts.length === 0 && (
                                                        <SelectItem value="none" disabled>No accounts found, please configure in Settings.</SelectItem>
                                                    )}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage className="text-rose-500" />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="category"
                                    render={({ field }: { field: any }) => (
                                        <FormItem>
                                            <FormLabel>Category</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger className="bg-zinc-950 border-zinc-800 text-zinc-300 focus:ring-emerald-500">
                                                        <SelectValue placeholder="Select category" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-50">
                                                    <SelectItem value="Need">Need</SelectItem>
                                                    <SelectItem value="Want">Want</SelectItem>
                                                    <SelectItem value="Other">Other</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage className="text-rose-500" />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <Button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-bold">
                                {isEditing ? "Save Changes" : "Save Entry"}
                            </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </div>
    );
}
