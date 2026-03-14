import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import * as XLSX from "xlsx";
import { format, startOfMonth, endOfMonth, parseISO, isAfter, isBefore, isEqual } from "date-fns";
import { Download, Calendar as CalendarIcon, Filter } from "lucide-react";

import { db } from "../db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { formatCurrency } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function Reports() {
    const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()));
    const [endDate, setEndDate] = useState<Date>(endOfMonth(new Date()));

    const transactions = useLiveQuery(() => db.transactions.orderBy('timestamp').reverse().toArray());

    // Filter transactions by date range
    const filteredTransactions = transactions?.filter(t => {
        const d = parseISO(t.timestamp);
        // set hours to 0 to compare just dates easily
        const tDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const sDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
        const eDate = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());

        return (isAfter(tDate, sDate) || isEqual(tDate, sDate)) &&
            (isBefore(tDate, eDate) || isEqual(tDate, eDate));
    }) || [];

    // Group by month string like "March 2026"
    const monthlySummary = filteredTransactions.reduce((acc, t) => {
        const monthYear = format(parseISO(t.timestamp), 'MMMM yyyy');
        if (!acc[monthYear]) {
            acc[monthYear] = { income: 0, expense: 0, net: 0, count: 0 };
        }
        acc[monthYear].count++;
        if (t.amount > 0) acc[monthYear].income += t.amount;
        if (t.amount < 0) acc[monthYear].expense += Math.abs(t.amount);
        acc[monthYear].net += t.amount;
        return acc;
    }, {} as Record<string, { income: number, expense: number, net: number, count: number }>);

    const exportToExcel = () => {
        if (filteredTransactions.length === 0) {
            alert("No data available to export in this date range.");
            return;
        }

        const exportData = filteredTransactions.map(t => ({
            Date: format(parseISO(t.timestamp), 'PPp'),
            Description: t.title,
            Category: t.source,
            Type: t.type,
            Amount: t.amount > 0 ? t.amount : -t.amount, // absolute val for sheet
            Sign: t.amount > 0 ? "Credit" : "Debit"
        }));

        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Transactions");

        const fileName = `PocketLedger_${format(startDate, 'yyyyMMdd')}_to_${format(endDate, 'yyyyMMdd')}.xlsx`;
        XLSX.writeFile(workbook, fileName);
    };

    return (
        <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
            <div>
                <h2 className="text-3xl font-bold tracking-tight text-zinc-50">Reports & Exports</h2>
                <p className="text-zinc-400">Analyze your spending and extract offline backups.</p>
            </div>

            <Card className="bg-zinc-900 border-zinc-800 text-zinc-50">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Filter className="w-5 h-5 text-emerald-400" />
                        Data Range Filter
                    </CardTitle>
                    <CardDescription className="text-zinc-400">Select the period for your report grouping and excel export.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col md:flex-row gap-6 mt-4 items-end">
                        <div className="flex flex-col gap-2 flex-1 w-full relative">
                            <Label className="text-zinc-300">Start Date</Label>
                            <Popover>
                                <PopoverTrigger>
                                    <div>
                                        <Button
                                            variant={"outline"}
                                            className={cn(
                                                "w-full justify-start text-left font-normal bg-zinc-950 border-zinc-800",
                                                !startDate && "text-muted-foreground"
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {startDate ? format(startDate, "PPP") : <span>Pick a date</span>}
                                        </Button>
                                    </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0 bg-zinc-900 border-zinc-800 z-50 pointer-events-auto" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={startDate}
                                        onSelect={(d) => d && setStartDate(d)}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div className="flex flex-col gap-2 flex-1 w-full relative">
                            <Label className="text-zinc-300">End Date</Label>
                            <Popover>
                                <PopoverTrigger>
                                    <div>
                                        <Button
                                            variant={"outline"}
                                            className={cn(
                                                "w-full justify-start text-left font-normal bg-zinc-950 border-zinc-800",
                                                !endDate && "text-muted-foreground"
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {endDate ? format(endDate, "PPP") : <span>Pick a date</span>}
                                        </Button>
                                    </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0 bg-zinc-900 border-zinc-800 z-50 pointer-events-auto" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={endDate}
                                        onSelect={(d) => d && setEndDate(d)}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>

                        <Button onClick={exportToExcel} className="w-full md:w-auto bg-emerald-500 hover:bg-emerald-600 text-zinc-950 gap-2">
                            <Download className="w-4 h-4" />
                            Export to Excel
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-zinc-900 border-zinc-800 text-zinc-50">
                <CardHeader>
                    <CardTitle>Monthly Summaries</CardTitle>
                    <CardDescription className="text-zinc-400">In the selected date range: {format(startDate, "MMM d, yyyy")} - {format(endDate, "MMM d, yyyy")}</CardDescription>
                </CardHeader>
                <CardContent>
                    {Object.keys(monthlySummary).length === 0 ? (
                        <div className="text-zinc-500 py-8 text-center bg-zinc-950/50 rounded border border-zinc-800 border-dashed">
                            No data points found in this range.
                        </div>
                    ) : (
                        <Table>
                            <TableHeader className="border-zinc-800">
                                <TableRow className="border-zinc-800 hover:bg-zinc-800/50">
                                    <TableHead className="w-[150px] text-zinc-400">Month</TableHead>
                                    <TableHead className="text-zinc-400">Transactions</TableHead>
                                    <TableHead className="text-rose-400">Total Expense</TableHead>
                                    <TableHead className="text-emerald-400">Total Income</TableHead>
                                    <TableHead className="text-right text-zinc-400">Net Flow</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {Object.entries(monthlySummary).map(([month, data]) => (
                                    <TableRow key={month} className="border-zinc-800 hover:bg-zinc-800/50">
                                        <TableCell className="font-medium text-zinc-200">{month}</TableCell>
                                        <TableCell className="text-zinc-400">{data.count} entries</TableCell>
                                        <TableCell className="text-rose-400">{formatCurrency(data.expense)}</TableCell>
                                        <TableCell className="text-emerald-400">{formatCurrency(data.income)}</TableCell>
                                        <TableCell className={`text-right font-bold ${data.net >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                            {data.net > 0 ? "+" : ""}{formatCurrency(data.net)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
