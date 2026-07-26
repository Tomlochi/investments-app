import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Banknote, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { deposit, withdraw } from '../../features/cash/cashSlice';
import { formatCurrency, cn } from '../../lib/utils';
import type { RootState, AppDispatch } from '../../store';

export function CashCard() {
  const dispatch = useDispatch<AppDispatch>();
  const { balance, transactions } = useSelector((state: RootState) => state.cash);
  const [amount, setAmount] = useState('');

  const parsed = parseFloat(amount) || 0;

  const handle = (type: 'deposit' | 'withdraw') => {
    if (parsed <= 0) return;
    if (type === 'withdraw' && parsed > balance) return;
    dispatch(type === 'deposit' ? deposit(parsed) : withdraw(parsed));
    setAmount('');
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Banknote className="h-4 w-4 text-green-600 dark:text-green-500" />
          Cash
        </CardTitle>
        <span className="text-xl font-bold text-gray-900 dark:text-gray-100">{formatCurrency(balance)}</span>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2 items-center">
          <Input
            type="number"
            min={0}
            step={100}
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-32 h-9"
          />
          <Button size="sm" variant="outline" className="gap-1.5" disabled={parsed <= 0} onClick={() => handle('deposit')}>
            <ArrowDownToLine className="h-3.5 w-3.5" />
            Deposit
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={parsed <= 0 || parsed > balance}
            onClick={() => handle('withdraw')}
          >
            <ArrowUpFromLine className="h-3.5 w-3.5" />
            Withdraw
          </Button>
        </div>

        {transactions.length > 0 && (
          <div className="mt-3 space-y-1">
            {transactions.slice(0, 3).map(t => (
              <p key={t.id} className="text-xs text-gray-500 dark:text-gray-400">
                {new Date(t.date).toLocaleDateString()}{' '}
                <span className={cn('font-medium', t.type === 'deposit' ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500')}>
                  {t.type === 'deposit' ? '+' : '−'}{formatCurrency(t.amount)}
                </span>
              </p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
