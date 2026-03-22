import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import ExcelJS from "exceljs";
import { format, startOfMonth, endOfMonth, parseISO, isAfter, isBefore, isEqual } from "date-fns";
import { Download, Calendar as CalendarIcon, Filter, Upload } from "lucide-react";

import { db, type Transaction } from "../db";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const GOOGLE_SHEETS_ENDPOINT_KEY = "pocketledger.googleSheetsEndpoint";

interface AccountReportRow {
    name: string;
    openingBalance: number;
    closingBalance: number;
}

interface ReportPayload {
    reportName: string;
    exportedAt: string;
    dateRange: {
        start: string;
        end: string;
        label: string;
    };
    totals: {
        income: number;
        expense: number;
        net: number;
        closingBalance: number;
    };
    accounts: AccountReportRow[];
    transactions: Array<Pick<Transaction, "id" | "timestamp" | "title" | "amount" | "type" | "source" | "toSource" | "category">>;
}

function isValidHttpUrl(value: string) {
    try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:";
    } catch {
        return false;
    }
}

function buildGoogleSheetsTestUrl(endpoint: string) {
    const url = new URL(endpoint);
    url.searchParams.set("action", "test");
    return url.toString();
}

function toDateOnly(value: Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function isFullMonthRange(startDate: Date, endDate: Date) {
    const start = toDateOnly(startDate);
    const end = toDateOnly(endDate);

    return isEqual(start, startOfMonth(start)) && isEqual(end, endOfMonth(end)) && start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
}

function getReportName(startDate: Date, endDate: Date) {
    if (isFullMonthRange(startDate, endDate)) {
        return format(startDate, "yyyy-MM");
    }

    return `${format(startDate, "yyyyMMdd")}_to_${format(endDate, "yyyyMMdd")}`;
}

export function Reports() {
    const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()));
    const [endDate, setEndDate] = useState<Date>(endOfMonth(new Date()));
    const [isExportingToGoogleSheet, setIsExportingToGoogleSheet] = useState(false);

    const transactions = useLiveQuery(() => db.transactions.orderBy('timestamp').reverse().toArray());
    const accounts = useLiveQuery(() => db.accounts.toArray());

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

    // Calculate totals across the selected date range
    const totals = filteredTransactions.reduce((acc, t) => {
        if (t.type === 'Transfer') return acc;
        if (t.amount > 0) acc.income += t.amount;
        if (t.amount < 0) acc.expense += Math.abs(t.amount);
        acc.net += t.amount;
        return acc;
    }, { income: 0, expense: 0, net: 0 });

    const getReportData = () => {
        if (!transactions || !accounts) return null;

        const accountStats: AccountReportRow[] = accounts.map(acc => {
            const beforeTxs = transactions.filter(t => {
                const tDate = new Date(parseISO(t.timestamp).setHours(0, 0, 0, 0));
                const sDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
                return isBefore(tDate, sDate);
            });
            const openingTxSum = beforeTxs.reduce((sum, t) => {
                if (t.type !== 'Transfer' && t.source === acc.name) return sum + t.amount;
                if (t.type === 'Transfer' && t.source === acc.name) return sum - t.amount;
                if (t.type === 'Transfer' && t.toSource === acc.name) return sum + t.amount;
                return sum;
            }, 0);
            const openingBalance = acc.initialBalance + openingTxSum;

            const periodTxSum = filteredTransactions.reduce((sum, t) => {
                if (t.type !== 'Transfer' && t.source === acc.name) return sum + t.amount;
                if (t.type === 'Transfer' && t.source === acc.name) return sum - t.amount;
                if (t.type === 'Transfer' && t.toSource === acc.name) return sum + t.amount;
                return sum;
            }, 0);
            const closingBalance = openingBalance + periodTxSum;

            return { name: acc.name, openingBalance, closingBalance };
        });

        const globalClosingBalance = accountStats.reduce((sum, a) => sum + a.closingBalance, 0);
        const reportName = getReportName(startDate, endDate);
        const reportPayload: ReportPayload = {
            reportName,
            exportedAt: new Date().toISOString(),
            dateRange: {
                start: startDate.toISOString(),
                end: endDate.toISOString(),
                label: `${format(startDate, 'MMM d, yyyy')} to ${format(endDate, 'MMM d, yyyy')}`,
            },
            totals: {
                income: totals.income,
                expense: totals.expense,
                net: totals.net,
                closingBalance: globalClosingBalance,
            },
            accounts: accountStats,
            transactions: filteredTransactions.map((transaction) => ({
                id: transaction.id,
                timestamp: transaction.timestamp,
                title: transaction.title,
                amount: transaction.amount,
                type: transaction.type,
                source: transaction.source,
                toSource: transaction.toSource,
                category: transaction.category,
            })),
        };

        return { accountStats, globalClosingBalance, reportName, reportPayload };
    };

    const getGoogleSheetsEndpoint = async () => {
        const savedEndpoint = localStorage.getItem(GOOGLE_SHEETS_ENDPOINT_KEY)?.trim() ?? "";
        let candidateEndpoint = savedEndpoint;

        if (candidateEndpoint) {
            const shouldReuse = window.confirm(
                `Use the saved Google Sheets endpoint?\n\n${candidateEndpoint}\n\nPress OK to reuse it or Cancel to enter a different one.`
            );

            if (shouldReuse) {
                return candidateEndpoint;
            }
        }

        const enteredEndpoint = window.prompt(
            "Enter the Google Apps Script endpoint URL for Google Sheets export.",
            candidateEndpoint
        );

        if (enteredEndpoint === null) {
            return null;
        }

        candidateEndpoint = enteredEndpoint.trim();

        if (!candidateEndpoint || !isValidHttpUrl(candidateEndpoint)) {
            alert("Please enter a valid http or https endpoint URL.");
            return null;
        }

        try {
            const response = await fetch(buildGoogleSheetsTestUrl(candidateEndpoint), {
                method: "GET",
            });

            if (!response.ok) {
                throw new Error(`Request failed with status ${response.status}`);
            }

            const result = await response.json() as { success?: boolean };
            if (!result.success) {
                throw new Error("Endpoint test did not report success.");
            }
        } catch (error) {
            console.error("Failed to validate Google Sheets endpoint", error);
            alert("The Google Sheets endpoint test failed. Please confirm the Apps Script web app URL is correct and deployed.");
            return null;
        }

        localStorage.setItem(GOOGLE_SHEETS_ENDPOINT_KEY, candidateEndpoint);
        return candidateEndpoint;
    };

    const exportToExcel = async () => {
        const reportData = getReportData();
        if (!reportData) return;
        if (filteredTransactions.length === 0) {
            alert("No data available to export in this date range.");
            return;
        }

        const { accountStats, globalClosingBalance, reportName } = reportData;

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet("Financial Report");

        sheet.columns = [
            { width: 25 },
            { width: 25 },
            { width: 20 },
            { width: 15 },
            { width: 15 },
            { width: 15 }
        ];

        const titleRow = sheet.addRow(["PocketLedger Financial Report"]);
        titleRow.font = { size: 16, bold: true };
        sheet.mergeCells('A1:F1');

        const dateRow = sheet.addRow([`Date Range: ${format(startDate, 'MMM d, yyyy')} to ${format(endDate, 'MMM d, yyyy')}`]);
        dateRow.font = { italic: true, color: { argb: 'FF666666' } };
        sheet.mergeCells('A2:F2');

        sheet.addRow([]);

        const metricsHeader = sheet.addRow(["Total Balance (Closing)", "Total Income", "Total Expense", "Net Flow", "", "", ""]);
        metricsHeader.height = 22.5;
        const metricsValues = sheet.addRow([globalClosingBalance, totals.income, totals.expense, totals.net, "", "", ""]);
        metricsValues.height = 22.5;

        const headerColors = ['FF1F4E79', 'FF70AD47', 'FFC00000', 'FFD9D9D9'];
        const textColors = ['FFFFFFFF', 'FFFFFFFF', 'FFFFFFFF', 'FF000000'];

        for (let i = 1; i <= 4; i++) {
            const hCell = metricsHeader.getCell(i);
            const vCell = metricsValues.getCell(i);

            hCell.font = { bold: true, color: { argb: textColors[i - 1] } };
            hCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerColors[i - 1] } };
            hCell.alignment = { horizontal: 'center', vertical: 'middle' };

            vCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerColors[i - 1] } };
            vCell.alignment = { horizontal: 'center', vertical: 'middle' };

            if (i <= 3) {
                vCell.font = { color: { argb: textColors[i - 1] } };
                vCell.numFmt = '₹#,##0.00;₹-#,##0.00';
            } else {
                vCell.numFmt = '₹#,##0.00;[Red]₹-#,##0.00';
            }
        }

        sheet.addRow([]);

        const accountHeaderTitle = sheet.addRow(["Account Balances", "", "", ""]);
        sheet.mergeCells(`A${accountHeaderTitle.number}:C${accountHeaderTitle.number}`);
        for (let i = 1; i <= 3; i++) {
            const cell = accountHeaderTitle.getCell(i);
            cell.font = { bold: true };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        }

        const accColHeader = sheet.addRow(["Account Name", "Opening Balance", "Closing Balance", ""]);
        for (let i = 1; i <= 3; i++) {
            const cell = accColHeader.getCell(i);
            cell.font = { bold: true };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
        }

        accountStats.forEach(acc => {
            const row = sheet.addRow([acc.name, acc.openingBalance, acc.closingBalance, ""]);
            row.getCell(2).numFmt = '₹#,##0.00;[Red]₹-#,##0.00';
            row.getCell(3).numFmt = '₹#,##0.00;[Red]₹-#,##0.00';
            for (let i = 1; i <= 3; i++) {
                row.getCell(i).border = { top: { style: 'thin', color: { argb: 'FFDDDDDD' } }, left: { style: 'thin', color: { argb: 'FFDDDDDD' } }, bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } }, right: { style: 'thin', color: { argb: 'FFDDDDDD' } } };
            }
        });

        sheet.addRow([]);

        const logHeaderTitle = sheet.addRow(["Transactions Log", "", "", "", "", ""]);
        sheet.mergeCells(`A${logHeaderTitle.number}:F${logHeaderTitle.number}`);
        for (let i = 1; i <= 6; i++) {
            const cell = logHeaderTitle.getCell(i);
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F75B5' } };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        }

        const txHeaders = ["Date", "Description", "Account", "Category", "Type", "Amount"];
        const txHeaderRow = sheet.addRow(txHeaders);
        for (let i = 1; i <= 6; i++) {
            const cell = txHeaderRow.getCell(i);
            cell.font = { bold: true };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        }

        filteredTransactions.forEach((t, index) => {
            const row = sheet.addRow([
                format(parseISO(t.timestamp), 'PPp'),
                t.title,
                t.type === 'Transfer' ? `${t.source} -> ${t.toSource}` : t.source,
                t.category || '-',
                t.type,
                t.amount
            ]);

            row.getCell(6).numFmt = '₹#,##0.00;[Red]₹-#,##0.00';

            const isAlt = index % 2 === 1;

            for (let i = 1; i <= 6; i++) {
                const cell = row.getCell(i);
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFDDDDDD' } },
                    left: { style: 'thin', color: { argb: 'FFDDDDDD' } },
                    bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } },
                    right: { style: 'thin', color: { argb: 'FFDDDDDD' } }
                };
                if (isAlt) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9F9F9' } };
                }
            }
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `PocketLedger_${reportName}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const exportToGoogleSheet = async () => {
        const reportData = getReportData();
        if (!reportData) return;
        if (filteredTransactions.length === 0) {
            alert("No data available to export in this date range.");
            return;
        }

        const endpoint = await getGoogleSheetsEndpoint();
        if (!endpoint) {
            return;
        }

        setIsExportingToGoogleSheet(true);

        try {
            const response = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(reportData.reportPayload),
            });

            if (!response.ok) {
                throw new Error(`Request failed with status ${response.status}`);
            }

            alert("Report exported to Google Sheet successfully.");
        } catch (error) {
            console.error("Failed to export to Google Sheet", error);
            alert("Failed to export to Google Sheet. Please verify the endpoint and try again.");
        } finally {
            setIsExportingToGoogleSheet(false);
        }
    };

    return (
        <div className="p-4 md:p-8 space-y-4 animate-in fade-in duration-500">
            <div>
                <h2 className="text-lg md:text-3xl font-bold tracking-tight text-zinc-50">Reports & Exports</h2>
                <p className="text-zinc-400 text-sm md:text-lg">Analyze your spending and extract offline backups.</p>
            </div>

            <div className="flex flex-col md:flex-row items-center justify-between gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-3">
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <Filter className="w-5 h-5 text-emerald-400 hidden sm:block" />

                    <Popover>
                        <PopoverTrigger
                            className={cn(
                                buttonVariants({ variant: "outline" }),
                                "w-[140px] sm:w-[180px] justify-start text-left font-normal bg-zinc-950 border-zinc-800",
                                !startDate && "text-muted-foreground"
                            )}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {startDate ? format(startDate, "MMM d, yyyy") : <span>Start</span>}
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

                    <span className="text-zinc-500 font-medium">to</span>

                    <Popover>
                        <PopoverTrigger
                            className={cn(
                                buttonVariants({ variant: "outline" }),
                                "w-[140px] sm:w-[180px] justify-start text-left font-normal bg-zinc-950 border-zinc-800",
                                !endDate && "text-muted-foreground"
                            )}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {endDate ? format(endDate, "MMM d, yyyy") : <span>End</span>}
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

                <div className="flex w-full md:w-auto flex-col sm:flex-row gap-2">
                    <Button
                        onClick={exportToExcel}
                        size="sm"
                        className="w-full md:w-auto bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-medium whitespace-nowrap"
                    >
                        <Download className="w-4 h-4 mr-2" />
                        Download as Excel File
                    </Button>
                    <Button
                        onClick={exportToGoogleSheet}
                        size="sm"
                        disabled={isExportingToGoogleSheet}
                        className="w-full md:w-auto bg-blue-500 hover:bg-blue-600 text-white font-medium whitespace-nowrap disabled:opacity-70"
                    >
                        <Upload className="w-4 h-4 mr-2" />
                        {isExportingToGoogleSheet ? "Exporting..." : "Export to Google Sheet"}
                    </Button>
                </div>
            </div>

            <Card className="bg-zinc-900 border-zinc-800 text-zinc-50">
                <CardHeader>
                    <CardTitle>Transactions Log</CardTitle>
                    <CardDescription className="text-zinc-400">Showing {filteredTransactions.length} entries between {format(startDate, "MMM d, yyyy")} and {format(endDate, "MMM d, yyyy")}</CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                    {filteredTransactions.length === 0 ? (
                        <div className="text-zinc-500 py-8 text-center bg-zinc-950/50 rounded border border-zinc-800 border-dashed">
                            No data points found in this range.
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mb-4">
                                <div className="flex items-center justify-between sm:justify-start sm:gap-2 bg-zinc-950 rounded-md border border-zinc-800 px-3 py-2 flex-1">
                                    <span className="text-sm font-medium text-zinc-400">Income</span>
                                    <span className="font-bold text-emerald-400">{formatCurrency(totals.income)}</span>
                                </div>
                                <div className="flex items-center justify-between sm:justify-start sm:gap-2 bg-zinc-950 rounded-md border border-zinc-800 px-3 py-2 flex-1">
                                    <span className="text-sm font-medium text-zinc-400">Expense</span>
                                    <span className="font-bold text-rose-400">{formatCurrency(totals.expense)}</span>
                                </div>
                                <div className="flex items-center justify-between sm:justify-start sm:gap-2 bg-zinc-950 rounded-md border border-zinc-800 px-3 py-2 flex-1">
                                    <span className="text-sm font-medium text-zinc-400">Net Flow</span>
                                    <span className={`font-bold ${totals.net >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                        {totals.net > 0 ? "+" : ""}{formatCurrency(totals.net)}
                                    </span>
                                </div>
                            </div>

                            <Table>
                                <TableHeader className="border-zinc-800">
                                    <TableRow className="border-zinc-800 hover:bg-zinc-800/50">
                                        <TableHead className="w-[120px] text-zinc-400">Date</TableHead>
                                        <TableHead className="text-zinc-400">Title</TableHead>
                                        <TableHead className="text-zinc-400 hidden sm:table-cell">Source</TableHead>
                                        <TableHead className="text-zinc-400 hidden sm:table-cell">Cash Flow</TableHead>
                                        <TableHead className="text-right text-zinc-400">Amount</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredTransactions.map((t) => (
                                        <TableRow key={t.id} className="border-zinc-800 hover:bg-zinc-800/50">
                                            <TableCell className="font-medium text-zinc-300">
                                                {format(parseISO(t.timestamp), 'MMM d, yyyy')}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="text-zinc-200">{t.title}</span>
                                                    <span className="text-xs text-zinc-500 sm:hidden">
                                                        {t.type === 'Transfer' ? `${t.source} → ${t.toSource}` : t.source}
                                                        {t.category ? ` • ${t.category}` : ''}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="hidden sm:table-cell">
                                                {t.type === 'Transfer' ? (
                                                    <div className="flex items-center gap-1 text-xs text-zinc-400">
                                                        <span>{t.source}</span>
                                                        <span>→</span>
                                                        <span>{t.toSource}</span>
                                                    </div>
                                                ) : (
                                                    <Badge variant="outline" className="border-zinc-700 text-zinc-300">{t.source}</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="hidden sm:table-cell">
                                                <div className="flex gap-2">
                                                    <Badge variant="secondary" className="bg-zinc-800 text-zinc-300 hover:bg-zinc-700">{t.type}</Badge>
                                                    {t.category && (
                                                        <Badge variant="outline" className={`border-zinc-700 ${t.category === 'Need' ? 'text-blue-400' : t.category === 'Want' ? 'text-purple-400' : 'text-zinc-400'}`}>
                                                            {t.category}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className={`text-right ${t.type === 'Transfer' ? 'text-blue-400' : t.amount > 0 ? 'text-emerald-400' : 'text-zinc-100'}`}>
                                                {t.type === 'Transfer' ? '' : t.amount > 0 ? '+' : '-'}{formatCurrency(Math.abs(t.amount))}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
