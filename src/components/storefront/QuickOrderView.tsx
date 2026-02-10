import { useState } from 'react';
import { ListOrdered, Plus, Trash2 } from 'lucide-react';

interface OrderLine {
  id: string;
  sku: string;
  quantity: number;
}

export function QuickOrderView() {
  const [orderLines, setOrderLines] = useState<OrderLine[]>([
    { id: '1', sku: '', quantity: 1 }
  ]);

  const addLine = () => {
    setOrderLines([...orderLines, { id: Date.now().toString(), sku: '', quantity: 1 }]);
  };

  const removeLine = (id: string) => {
    setOrderLines(orderLines.filter(line => line.id !== id));
  };

  const updateLine = (id: string, field: 'sku' | 'quantity', value: string | number) => {
    setOrderLines(orderLines.map(line =>
      line.id === id ? { ...line, [field]: value } : line
    ));
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center mb-2">
          <ListOrdered className="w-8 h-8 text-blue-600 mr-3" />
          <h2 className="text-3xl font-bold text-gray-900">Quick Order</h2>
        </div>
        <p className="text-gray-600">Rapid SKU-based ordering optimized for repeat purchases</p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="space-y-3 mb-6">
          <div className="grid grid-cols-12 gap-4 font-medium text-sm text-gray-600 px-2">
            <div className="col-span-7">SKU</div>
            <div className="col-span-3">Quantity</div>
            <div className="col-span-2"></div>
          </div>

          {orderLines.map((line, index) => (
            <div key={line.id} className="grid grid-cols-12 gap-4 items-center">
              <div className="col-span-7">
                <input
                  type="text"
                  value={line.sku}
                  onChange={(e) => updateLine(line.id, 'sku', e.target.value)}
                  placeholder="Enter SKU or product code"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="col-span-3">
                <input
                  type="number"
                  min="1"
                  value={line.quantity}
                  onChange={(e) => updateLine(line.id, 'quantity', parseInt(e.target.value) || 1)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="col-span-2">
                {orderLines.length > 1 && (
                  <button
                    onClick={() => removeLine(line.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={addLine}
          className="flex items-center space-x-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors mb-6"
        >
          <Plus className="w-5 h-5" />
          <span>Add Line</span>
        </button>

        <div className="border-t border-gray-200 pt-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-lg font-medium text-gray-900">Total Items:</span>
            <span className="text-2xl font-bold text-gray-900">
              {orderLines.reduce((sum, line) => sum + line.quantity, 0)}
            </span>
          </div>

          <button className="w-full py-3 px-6 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">
            Add to Cart
          </button>
        </div>
      </div>

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-medium text-blue-900 mb-2">Pro Tips:</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>Paste SKUs from your existing order sheets</li>
          <li>Use Tab to quickly move between fields</li>
          <li>Save frequently ordered items for even faster reordering</li>
        </ul>
      </div>
    </div>
  );
}
