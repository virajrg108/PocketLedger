
import { useLiveQuery } from "dexie-react-hooks";
import { Link } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { db } from "../db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DollarSign, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export function Dashboard() {
    const transactions = useLiveQuery(() => db.transactions.orderBy('timestamp').reverse().toArray());
    const accounts = useLiveQuery(() => db.accounts.toArray());

    if (!transactions || !accounts) return <div className="p-8 text-zinc-400">Loading offline data...</div>;

    // We don't need hardcoded balances anymore, just use the array

    // Calculate global metrics if needed, currently dynamically building via grid

    const handleDelete = async (id?: number) => {
        if (!id) return;
        if (window.confirm("Are you sure you want to delete this transaction from your history?")) {
            await db.transactions.delete(id);
        }
    };

    return (
        <div className="flex flex-col flex-1 p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
            <div>
                <h2 className="text-3xl font-bold tracking-tight text-zinc-50">Overview</h2>
                <p className="text-zinc-400">Your financial snapshot based on local data.</p>
            </div>

            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                {accounts.map(acc => {
                    const txSum = transactions.reduce((sum, t) => {
                        if (t.type !== 'Transfer' && t.source === acc.name) {
                            return sum + t.amount;
                        }
                        if (t.type === 'Transfer') {
                            if (t.source === acc.name) return sum - t.amount;
                            if (t.toSource === acc.name) return sum + t.amount;
                        }
                        return sum;
                    }, 0);
                    const currentBalance = acc.initialBalance + txSum;

                    return (
                        <Card key={acc.id} className="bg-zinc-900 border-zinc-800 text-zinc-50 col-span-2 lg:col-span-1">
                            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                                <CardTitle className="text-sm font-medium">{acc.name}</CardTitle>
                                <DollarSign className="w-4 h-4 text-zinc-400" />
                            </CardHeader>
                            <CardContent>
                                <div className={`text-2xl font-bold ${currentBalance < 0 ? 'text-rose-400' : 'text-zinc-50'}`}>
                                    {currentBalance < 0 ? '-' : ''}{formatCurrency(currentBalance)}
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            <Card className="bg-zinc-900 border-zinc-800 text-zinc-50">
                <CardHeader>
                    <CardTitle>Recent History</CardTitle>
                    <CardDescription className="text-zinc-400">Your most recent local transactions.</CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                    <Table>
                        <TableHeader className="border-zinc-800">
                            <TableRow className="border-zinc-800 hover:bg-zinc-800/50">
                                <TableHead className="w-[60px] text-zinc-400">Date</TableHead>
                                <TableHead className="text-zinc-400">Title</TableHead>
                                <TableHead className="text-zinc-400 hidden md:table-cell">Source</TableHead>
                                <TableHead className="text-zinc-400 hidden sm:table-cell">Cash Flow</TableHead>
                                <TableHead className="text-right text-zinc-400">Amount</TableHead>
                                <TableHead className="w-[80px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {transactions.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center text-zinc-500">
                                        No transactions yet. Click 'New Entry' to add one.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                transactions.slice(0, 10).map((t) => (
                                    <TableRow key={t.id} className="border-zinc-800 hover:bg-zinc-800/50">
                                        <TableCell className="font-medium text-zinc-300">
                                            {format(parseISO(t.timestamp), 'dd/MM')}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <Link to={`/edit/${t.id}`} className="hover:underline hover:text-emerald-400 font-semibold mb-1">
                                                    {t.title}
                                                </Link>
                                                {/* On mobile, show the source as a small subtitle if it's hidden from the main column */}
                                                <span className="text-xs text-zinc-500 md:hidden">
                                                    {t.type === 'Transfer' ? `${t.source} → ${t.toSource}` : t.source}
                                                    {t.category ? ` • ${t.category}` : ''}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="hidden md:table-cell">
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
                                        <TableCell className="text-right">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-zinc-500 hover:text-rose-400 hover:bg-rose-400/10"
                                                onClick={() => handleDelete(t.id)}
                                                title="Delete Transaction"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
