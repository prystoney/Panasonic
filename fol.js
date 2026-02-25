import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, doc, setDoc, getDoc, 
  onSnapshot, addDoc, query, orderBy, Timestamp 
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken 
} from 'firebase/auth';
import { 
  ShoppingCart, Package, TrendingUp, Phone, Mail, 
  Plus, Trash2, Download, Search, Edit3, X, Save, 
  Calendar, ChevronRight, FileText
} from 'lucide-react';

// --- Firebase Configuration ---
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'panasonic-junior-merch';

const App = () => {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('sales');
  const [inventory, setInventory] = useState([]);
  const [sales, setSales] = useState([]);
  const [cart, setCart] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  
  // UI State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({ name: '', category: 'Cyber', cost: 0, price: 0 });

  // --- 1. Authentication ---
  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // --- 2. Real-time Data Sync ---
  useEffect(() => {
    if (!user) return;

    // Sync Inventory
    const invCol = collection(db, 'artifacts', appId, 'public', 'data', 'inventory');
    const unsubInv = onSnapshot(invCol, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      if (items.length === 0 && inventory.length === 0) {
        // Initial seed data if empty
        const seed = [
          { name: 'Printing (B/W)', category: 'Cyber', cost: 2, price: 10 },
          { name: 'Coca-Cola 500ml', category: 'Drinks', cost: 55, price: 65 },
          { name: 'Predator Energy', category: 'Drinks', cost: 75, price: 100 }
        ];
        seed.forEach(item => addDoc(invCol, item));
      }
      setInventory(items);
    });

    // Sync Sales
    const salesCol = collection(db, 'artifacts', appId, 'public', 'data', 'sales');
    const unsubSales = onSnapshot(salesCol, (snapshot) => {
      const records = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date()
      }));
      setSales(records);
    });

    return () => { unsubInv(); unsubSales(); };
  }, [user]);

  // --- 3. Inventory Actions ---
  const handleSaveItem = async (e) => {
    e.preventDefault();
    const itemData = { 
      name: formData.name, 
      category: formData.category, 
      cost: Number(formData.cost), 
      price: Number(formData.price) 
    };

    const invCol = collection(db, 'artifacts', appId, 'public', 'data', 'inventory');
    if (editingItem) {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'inventory', editingItem.id), itemData);
    } else {
      await addDoc(invCol, itemData);
    }
    setIsModalOpen(false);
  };

  // --- 4. Sales Actions ---
  const checkout = async () => {
    if (cart.length === 0 || !user) return;
    
    const salesCol = collection(db, 'artifacts', appId, 'public', 'data', 'sales');
    
    for (const item of cart) {
      await addDoc(salesCol, {
        name: item.name,
        qty: item.qty,
        cost: item.cost,
        price: item.price,
        totalPrice: item.price * item.qty,
        profit: (item.price - item.cost) * item.qty,
        timestamp: Timestamp.now(),
        userId: user.uid
      });
    }
    setCart([]);
    setActiveTab('reports');
  };

  // --- 5. Report Filtering ---
  const filteredSales = sales.filter(sale => {
    if (!dateRange.start || !dateRange.end) return true;
    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);
    end.setHours(23, 59, 59);
    return sale.timestamp >= start && sale.timestamp <= end;
  });

  const totalRevenue = filteredSales.reduce((sum, s) => sum + s.totalPrice, 0);
  const totalProfit = filteredSales.reduce((sum, s) => sum + s.profit, 0);

  // --- 6. Export Function ---
  const exportToCSV = () => {
    const headers = "Date,Item,Qty,Price,Revenue,Profit\n";
    const rows = filteredSales.map(s => 
      `${s.timestamp.toLocaleDateString()},${s.name},${s.qty},${s.price},${s.totalPrice},${s.profit}`
    ).join("\n");
    
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', `Panasonic_Report_${dateRange.start || 'all'}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-10">
      {/* Branding Header */}
      <header className="bg-[#1e3a8a] text-white p-6 shadow-2xl">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-white p-3 rounded-2xl shadow-inner">
               <FileText size={32} color="#1e3a8a" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight uppercase italic">PANASONIC junior merchandise</h1>
              <div className="flex flex-wrap gap-4 text-xs opacity-80 mt-1 font-mono">
                <span className="flex items-center gap-1"><Phone size={12}/> 0725073102</span>
                <span className="flex items-center gap-1"><Mail size={12}/> ccarepanasonic@gmail.com</span>
              </div>
            </div>
          </div>
          <div className="bg-white/10 px-6 py-3 rounded-2xl border border-white/20 backdrop-blur-sm text-center">
            <p className="text-[10px] uppercase font-black opacity-60 tracking-widest">Report Net Profit</p>
            <p className="text-2xl font-black text-green-400">Ksh {totalProfit.toLocaleString()}</p>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <nav className="bg-white border-b sticky top-0 z-20 flex justify-center gap-2 sm:gap-6 py-3 shadow-md px-2">
        {[
          { id: 'sales', icon: <ShoppingCart size={18}/>, label: 'Sales' },
          { id: 'inventory', icon: <Package size={18}/>, label: 'Inventory' },
          { id: 'reports', icon: <TrendingUp size={18}/>, label: 'Reports' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 sm:px-6 py-2 rounded-xl transition-all font-bold text-sm ${
              activeTab === tab.id ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            {tab.icon} <span>{tab.label}</span>
          </button>
        ))}
      </nav>

      <main className="max-w-7xl mx-auto p-4 md:p-8">
        {/* SALES TAB */}
        {activeTab === 'sales' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20}/>
                <input 
                  type="text" 
                  placeholder="Search item..." 
                  className="w-full pl-12 pr-4 py-4 rounded-2xl border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-600 shadow-sm"
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {inventory.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase())).map(product => (
                  <button
                    key={product.id}
                    onClick={() => {
                      const exists = cart.find(c => c.id === product.id);
                      if(exists) setCart(cart.map(c => c.id === product.id ? {...c, qty: c.qty + 1} : c));
                      else setCart([...cart, {...product, qty: 1}]);
                    }}
                    className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:scale-[1.02] transition-all text-left group"
                  >
                    <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg uppercase">{product.category}</span>
                    <h3 className="font-bold text-slate-800 mt-3 h-10 overflow-hidden">{product.name}</h3>
                    <p className="text-xl font-black text-slate-900 mt-2">Ksh {product.price}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Checkout Sidebar */}
            <div className="bg-white rounded-[2rem] shadow-2xl border border-slate-100 h-fit flex flex-col sticky top-24 overflow-hidden">
              <div className="p-6 bg-slate-50 border-b font-black flex justify-between items-center">
                <div className="flex items-center gap-2"><ShoppingCart size={20} className="text-blue-600"/> Order List</div>
                <button onClick={() => setCart([])} className="text-[10px] text-red-500 uppercase">Clear</button>
              </div>
              <div className="p-4 max-h-[400px] overflow-y-auto space-y-3">
                {cart.map(item => (
                  <div key={item.id} className="flex justify-between items-center bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <div>
                      <p className="font-bold text-sm leading-tight">{item.name}</p>
                      <p className="text-xs text-slate-500 font-bold">Ksh {item.price} x {item.qty}</p>
                    </div>
                    <button onClick={() => setCart(cart.filter(i => i.id !== item.id))} className="text-red-400 hover:bg-red-50 p-2 rounded-xl">
                      <Trash2 size={16}/>
                    </button>
                  </div>
                ))}
                {cart.length === 0 && <p className="text-center py-10 text-slate-300 font-bold italic">Cart is empty</p>}
              </div>
              <div className="p-6 bg-blue-50 border-t">
                <div className="flex justify-between items-center mb-6">
                  <span className="font-bold text-blue-900/60 uppercase text-xs tracking-widest">Total</span>
                  <span className="text-3xl font-black text-blue-900">Ksh {cart.reduce((a, b) => a + (b.price * b.qty), 0)}</span>
                </div>
                <button 
                  onClick={checkout}
                  disabled={cart.length === 0}
                  className="w-full bg-[#1e3a8a] text-white font-black py-5 rounded-2xl shadow-xl shadow-blue-200 active:scale-95 transition-all disabled:grayscale"
                >
                  Confirm & Save Sale
                </button>
              </div>
            </div>
          </div>
        )}

        {/* REPORTS TAB */}
        {activeTab === 'reports' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-[2rem] shadow-xl border border-slate-100 flex flex-wrap items-end gap-6">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Start Date</label>
                <input 
                  type="date" 
                  className="w-full p-3 rounded-xl border-slate-200 font-bold bg-slate-50 focus:ring-2 focus:ring-blue-500"
                  onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
                />
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">End Date</label>
                <input 
                  type="date" 
                  className="w-full p-3 rounded-xl border-slate-200 font-bold bg-slate-50 focus:ring-2 focus:ring-blue-500"
                  onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
                />
              </div>
              <button 
                onClick={exportToCSV}
                className="bg-green-600 text-white px-8 py-3.5 rounded-xl font-black flex items-center gap-2 hover:bg-green-700 transition-all shadow-lg shadow-green-100"
              >
                <Download size={18}/> Export Report
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
                <p className="text-xs font-black text-slate-400 uppercase">Gross Revenue</p>
                <p className="text-4xl font-black text-slate-900 mt-2">Ksh {totalRevenue.toLocaleString()}</p>
              </div>
              <div className="bg-white p-8 rounded-[2rem] border border-green-100 shadow-sm ring-8 ring-green-50/50">
                <p className="text-xs font-black text-green-600 uppercase">Total Net Profit</p>
                <p className="text-4xl font-black text-green-700 mt-2">Ksh {totalProfit.toLocaleString()}</p>
              </div>
            </div>

            <div className="bg-white rounded-[2rem] shadow-2xl border border-slate-100 overflow-hidden">
              <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                <h3 className="font-black text-slate-800">Detailed Transaction Log</h3>
                <span className="text-xs font-bold text-slate-400 tracking-tighter uppercase">{filteredSales.length} items found</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-white border-b text-[10px] font-black text-slate-400 uppercase">
                    <tr>
                      <th className="px-6 py-4">Timestamp</th>
                      <th className="px-6 py-4">Item</th>
                      <th className="px-6 py-4 text-center">Qty</th>
                      <th className="px-6 py-4">Total</th>
                      <th className="px-6 py-4 text-green-600">Profit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredSales.map(sale => (
                      <tr key={sale.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 text-[10px] font-mono font-bold text-slate-500 uppercase">{sale.timestamp.toLocaleString()}</td>
                        <td className="px-6 py-4 font-black text-slate-800 uppercase text-xs">{sale.name}</td>
                        <td className="px-6 py-4 text-center font-black text-slate-500">{sale.qty}</td>
                        <td className="px-6 py-4 font-black">Ksh {sale.totalPrice}</td>
                        <td className="px-6 py-4 text-green-600 font-black tracking-tighter">+Ksh {sale.profit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* INVENTORY TAB */}
        {activeTab === 'inventory' && (
          <div className="bg-white rounded-[2rem] shadow-2xl border border-slate-100 overflow-hidden">
            <div className="p-8 border-b flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50">
              <h2 className="text-2xl font-black text-slate-800 italic uppercase">Product Manager</h2>
              <button 
                onClick={() => { setEditingItem(null); setFormData({ name: '', category: 'Cyber', cost: 0, price: 0 }); setIsModalOpen(true); }}
                className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-black flex items-center gap-2 shadow-xl active:scale-95 transition-all"
              >
                <Plus size={20}/> New Product
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-white border-b text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                  <tr>
                    <th className="px-8 py-6">Product</th>
                    <th className="px-8 py-6">Category</th>
                    <th className="px-8 py-6">Cost Price</th>
                    <th className="px-8 py-6">Sell Price</th>
                    <th className="px-8 py-6 text-center">Manage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {inventory.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50 group transition-all">
                      <td className="px-8 py-5 font-black text-slate-800">{item.name}</td>
                      <td className="px-8 py-5">
                        <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider">{item.category}</span>
                      </td>
                      <td className="px-8 py-5 text-slate-500 font-bold italic">Ksh {item.cost}</td>
                      <td className="px-8 py-5 font-black text-blue-900">Ksh {item.price}</td>
                      <td className="px-8 py-5">
                        <div className="flex justify-center gap-3">
                          <button onClick={() => { setEditingItem(item); setFormData(item); setIsModalOpen(true); }} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all">
                            <Edit3 size={18}/>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* ITEM MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
            <div className="p-8 border-b bg-slate-50 flex justify-between items-center">
              <h3 className="text-xl font-black uppercase tracking-tight">{editingItem ? 'Update' : 'Register'} Item</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={24}/></button>
            </div>
            <form onSubmit={handleSaveItem} className="p-8 space-y-5">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Name</label>
                <input required type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full p-4 rounded-2xl border-slate-200 font-bold bg-slate-50 outline-none focus:ring-2 focus:ring-blue-600" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Cost (Ksh)</label>
                  <input required type="number" value={formData.cost} onChange={(e) => setFormData({...formData, cost: e.target.value})} className="w-full p-4 rounded-2xl border-slate-200 font-bold bg-slate-50 text-red-500" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Price (Ksh)</label>
                  <input required type="number" value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value})} className="w-full p-4 rounded-2xl border-slate-200 font-bold bg-slate-50 text-green-600" />
                </div>
              </div>
              <button type="submit" className="w-full bg-blue-600 text-white font-black py-5 rounded-2xl shadow-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-2">
                <Save size={20}/> Save Changes
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;