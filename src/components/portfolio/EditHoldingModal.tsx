import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { updateHolding } from '../../features/portfolio/portfolioSlice';
import { closeEditHoldingModal } from '../../features/ui/uiSlice';
import type { RootState, AppDispatch } from '../../store';

export function EditHoldingModal() {
  const dispatch = useDispatch<AppDispatch>();
  const editSymbol = useSelector((state: RootState) => state.ui.editHoldingSymbol);
  const holdings = useSelector((state: RootState) => state.portfolio.holdings);

  const holding = holdings.find((h) => h.symbol === editSymbol);

  const [quantity, setQuantity] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');

  useEffect(() => {
    if (holding) {
      setQuantity(holding.quantity.toString());
      setPurchasePrice(holding.purchasePrice.toString());
    }
  }, [holding]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSymbol || !quantity || !purchasePrice) return;

    dispatch(updateHolding({
      symbol: editSymbol,
      quantity: parseFloat(quantity),
      purchasePrice: parseFloat(purchasePrice),
    }));

    handleClose();
  };

  const handleClose = () => {
    dispatch(closeEditHoldingModal());
  };

  if (!holding) return null;

  return (
    <Dialog open={!!editSymbol} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Holding</DialogTitle>
          <DialogDescription>
            Update your position in <span className="font-semibold text-blue-600 dark:text-blue-400">{holding.symbol}</span> - {holding.name}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-quantity">Shares</Label>
              <Input
                id="edit-quantity"
                type="number"
                step="0.0001"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-price">Average Purchase Price</Label>
              <Input
                id="edit-price"
                type="number"
                step="0.01"
                min="0"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!quantity || !purchasePrice}>
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
