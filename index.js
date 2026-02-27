=        // --- GLOBAL STATE ---
        let db, auth, user, appId;
        let inventory = [], sales = [], cart = [];

        // --- CORE INITIALIZATION (Rule 3) ---
        async function init() {
            try {
                const firebaseConfig = JSON.parse(__firebase_config);
                firebase.initializeApp(firebaseConfig);
                db = firebase.firestore();
                auth = firebase.auth();
                appId = typeof __app_id !== 'undefined' ? __app_id : 'panasonic-junior-erp-final';

                // Sign in logic
                if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                    await auth.signInWithCustomToken(__initial_auth_token);
                } else {
                    await auth.signInAnonymously();
                }

                auth.onAuthStateChanged((u) => {
                    user = u;
                    if (user) {
                        document.getElementById('cloudStatus').innerHTML = `<span class="w-2 h-2 bg-green-400 rounded-full"></span> CLOUD CONNECTED: ${user.uid.substring(0,6)}`;
                        startSync();
                    }
                });

                // Default tab
                switchTab('sales');
            } catch (err) {
                console.error("System Crash:", err);
            }
        }

        // --- DATA SYNCHRONIZATION (Rule 1 & 2) ---
        function startSync() {
            if (!user) return;
            const root = db.collection('artifacts').doc(appId).collection('public').doc('data');

            // Inventory Listener
            root.collection('inventory').onSnapshot(snap => {
                inventory = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                renderPOS();
                renderInventory();
            }, err => console.error("Sync Error:", err));

            // Sales Listener
            root.collection('sales').onSnapshot(snap => {
                sales = snap.docs.map(doc => ({
                    id: doc.id, ...doc.data(),
                    timestamp: doc.data().timestamp?.toDate() || new Date()
                }));
                renderReports();
            }, err => console.error("Sync Error:", err));
        }

        // --- UI ROUTING ---
        window.switchTab = (id) => {
            document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('tab-active', 'text-slate-500'));
            
            const tab = document.getElementById(`tab-${id}`);
            const btn = document.getElementById(`btn-${id}`);
            
            if (tab) tab.classList.remove('hidden');
            if (btn) btn.classList.add('tab-active');
            
            // Refresh logic when switching
            if(id === 'sales') renderPOS();
            if(id === 'reports') renderReports();
        };

        // --- POINT OF SALE FUNCTIONALITY ---
        window.renderPOS = () => {
            const query = document.getElementById('posSearch').value.toLowerCase();
            const category = document.getElementById('posCatFilter').value;
            const grid = document.getElementById('posGrid');
            
            const filtered = inventory.filter(i => {
                const matchesSearch = i.name.toLowerCase().includes(query);
                const matchesCat = category === 'All' || i.category === category;
                return matchesSearch && matchesCat;
            });

            grid.innerHTML = filtered.map(item => `
                <button onclick="addToCart('${item.id}')" class="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:ring-2 hover:ring-blue-200 transition-all text-left flex flex-col justify-between group h-32 active:scale-95">
                    <span class="text-[7px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full uppercase self-start">${item.category}</span>
                    <div>
                        <h3 class="font-bold text-slate-800 text-[11px] leading-tight mb-1 truncate w-full">${item.name}</h3>
                        <p class="text-sm font-black text-slate-900 font-mono tracking-tighter">Ksh ${item.price.toLocaleString()}</p>
                    </div>
                </button>
            `).join('');

            if (!filtered.length && inventory.length > 0) {
                grid.innerHTML = `<div class="col-span-full py-20 text-center text-slate-400 font-bold italic text-xs">No products found matching filters.</div>`;
            }
        };

        window.addToCart = (id) => {
            const item = inventory.find(i => i.id === id);
            const inCart = cart.find(c => c.id === id);
            if (inCart) inCart.qty++; else cart.push({...item, qty: 1});
            renderCart();
        };

        window.renderCart = () => {
            const list = document.getElementById('cartList');
            let total = 0;
            list.innerHTML = cart.map(item => {
                const lineTotal = item.price * item.qty;
                total += lineTotal;
                return `
                    <div class="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                        <div class="flex-1 min-w-0 mr-3">
                            <p class="font-black text-[11px] text-slate-800 truncate mb-1">${item.name}</p>
                            <p class="text-[9px] text-slate-400 font-mono font-bold tracking-widest">KSH ${item.price} × ${item.qty}</p>
                        </div>
                        <div class="flex items-center gap-2">
                             <span class="text-xs font-black text-blue-900 font-mono">Ksh ${lineTotal}</span>
                             <button onclick="removeFromCart('${item.id}')" class="text-red-200 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-xl transition-all">
                                <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
                             </button>
                        </div>
                    </div>
                `;
            }).join('');
            document.getElementById('cartTotal').innerText = `Ksh ${total.toLocaleString()}`;
            if (!cart.length) list.innerHTML = `<div class="flex flex-col items-center justify-center h-full opacity-10 py-20"><svg width="60" height="60" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4H6z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 01-8 0"/></svg><p class="mt-4 font-black text-xs uppercase">Your cart is empty</p></div>`;
        };

        window.removeFromCart = (id) => { cart = cart.filter(c => c.id !== id); renderCart(); };
        window.clearCart = () => { cart = []; renderCart(); };

        window.processCheckout = async () => {
            if (!cart.length || !user) return;
            const btn = document.getElementById('checkoutBtn');
            btn.disabled = true; 
            btn.innerHTML = `<svg class="animate-spin h-5 w-5 mr-3 border-t-2 border-white rounded-full"></svg> SAVING TO CLOUD...`;
            
            try {
                const salesCol = db.collection('artifacts').doc(appId).collection('public').doc('data').collection('sales');
                const batch = db.batch(); // Optional but cleaner for multi-writes

                for (const item of cart) {
                    const saleDoc = salesCol.doc();
                    batch.set(saleDoc, {
                        name: item.name,
                        qty: item.qty,
                        cost: item.cost,
                        price: item.price,
                        totalPrice: item.price * item.qty,
                        profit: (item.price - item.cost) * item.qty,
                        timestamp: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }
                
                await batch.commit();
                cart = []; 
                renderCart(); 
                switchTab('reports');
            } catch (err) {
                console.error("Sale Recording Error:", err);
            } finally {
                btn.disabled = false; 
                btn.innerHTML = `Confirm & Record Sale <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`;
            }
        };

        // --- INVENTORY MANAGEMENT ---
        window.renderInventory = () => {
            const body = document.getElementById('inventoryTableBody');
            const empty = document.getElementById('inventoryEmpty');
            
            if (inventory.length === 0) {
                empty.classList.remove('hidden');
                body.innerHTML = '';
                return;
            }
            empty.classList.add('hidden');

            body.innerHTML = inventory.sort((a,b) => a.name.localeCompare(b.name)).map(item => `
                <tr class="hover:bg-slate-50/50 transition-colors group">
                    <td class="px-8 py-5">
                        <div class="font-black text-slate-800 text-[11px]">${item.name}</div>
                        <div class="text-[8px] text-slate-400 mt-0.5 font-mono">ID: ${item.id.substring(0,8)}</div>
                    </td>
                    <td class="px-8 py-5"><span class="text-[9px] bg-slate-100 px-3 py-1 rounded-full font-black text-slate-500 uppercase">${item.category}</span></td>
                    <td class="px-8 py-5 text-slate-400 font-mono text-xs">Ksh ${item.cost.toLocaleString()}</td>
                    <td class="px-8 py-5 text-slate-900 font-mono text-xs">Ksh ${item.price.toLocaleString()}</td>
                    <td class="px-8 py-5 text-green-600 font-mono text-xs font-black">+Ksh ${(item.price - item.cost).toLocaleString()}</td>
                    <td class="px-8 py-5 text-center flex items-center justify-center gap-2">
                        <button onclick="openModal('${item.id}')" class="text-blue-600 bg-blue-50 hover:bg-blue-600 hover:text-white px-4 py-2 rounded-xl font-black text-[9px] uppercase transition-all">Edit</button>
                        <button onclick="deleteItem('${item.id}')" class="text-red-400 bg-red-50 hover:bg-red-600 hover:text-white px-4 py-2 rounded-xl font-black text-[9px] uppercase transition-all">Del</button>
                    </td>
                </tr>
            `).join('');
        };

        window.openModal = (id = null) => {
            const editId = document.getElementById('editId');
            const saveBtn = document.getElementById('saveBtn');
            const modal = document.getElementById('itemModal');
            
            editId.value = id || "";
            document.getElementById('saveLoader').classList.add('hidden');
            saveBtn.classList.remove('opacity-50');

            if (id) {
                const item = inventory.find(i => i.id === id);
                document.getElementById('itemName').value = item.name;
                document.getElementById('itemCat').value = item.category;
                document.getElementById('itemCost').value = item.cost;
                document.getElementById('itemPrice').value = item.price;
                document.getElementById('modalTitle').innerText = "Modify Product";
            } else {
                document.getElementById('itemName').value = "";
                document.getElementById('itemCat').value = "General";
                document.getElementById('itemCost').value = "";
                document.getElementById('itemPrice').value = "";
                document.getElementById('modalTitle').innerText = "Cloud Registration";
            }
            modal.classList.remove('hidden');
        };

        window.closeModal = () => document.getElementById('itemModal').classList.add('hidden');

        window.saveItem = async () => {
            if (!user) return;
            const id = document.getElementById('editId').value;
            const btn = document.getElementById('saveBtn');
            const loader = document.getElementById('saveLoader');

            const data = {
                name: document.getElementById('itemName').value.trim(),
                category: document.getElementById('itemCat').value,
                cost: Number(document.getElementById('itemCost').value),
                price: Number(document.getElementById('itemPrice').value)
            };

            if (!data.name || isNaN(data.cost) || isNaN(data.price)) return;

            btn.disabled = true;
            btn.classList.add('opacity-50');
            loader.classList.remove('hidden');

            try {
                const col = db.collection('artifacts').doc(appId).collection('public').doc('data').collection('inventory');
                if (id) await col.doc(id).update(data); else await col.add(data);
                closeModal();
            } catch (err) {
                console.error("Cloud Error:", err);
            } finally {
                btn.disabled = false;
                btn.classList.remove('opacity-50');
                loader.classList.add('hidden');
            }
        };

        window.deleteItem = async (id) => {
            if (confirm("Permanently wipe this record from cloud storage?")) {
                await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('inventory').doc(id).delete();
            }
        };

        // --- FINANCIAL ANALYTICS ---
        window.renderReports = () => {
            const filterDate = document.getElementById('reportDate').value;
            const body = document.getElementById('salesTableBody');
            
            let filteredSales = [...sales];
            if (filterDate) {
                const searchD = new Date(filterDate).toDateString();
                filteredSales = sales.filter(s => s.timestamp.toDateString() === searchD);
            }

            let lifetimeProfit = 0;
            let todayRevenue = 0;
            const todayStr = new Date().toDateString();

            body.innerHTML = filteredSales.sort((a,b) => b.timestamp - a.timestamp).map(item => {
                lifetimeProfit += item.profit;
                if (item.timestamp.toDateString() === todayStr) {
                    todayRevenue += item.totalPrice;
                }

                return `
                    <tr class="hover:bg-slate-50 transition-colors">
                        <td class="px-8 py-5 text-slate-400 font-mono text-[10px] uppercase">
                            ${item.timestamp.toLocaleDateString()} ${item.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </td>
                        <td class="px-8 py-5 text-slate-800 uppercase tracking-tight">${item.name}</td>
                        <td class="px-8 py-5 text-center text-slate-500">${item.qty}</td>
                        <td class="px-8 py-5 text-slate-900 font-mono">Ksh ${item.totalPrice.toLocaleString()}</td>
                        <td class="px-8 py-5 text-green-600 font-mono font-black">+Ksh ${item.profit.toLocaleString()}</td>
                    </tr>
                `;
            }).join('');

            // Global Lifetime total regardless of date filter for the header
            const globalProfit = sales.reduce((acc, s) => acc + s.profit, 0);

            document.getElementById('headerProfit').innerText = `Ksh ${globalProfit.toLocaleString()}`;
            document.getElementById('reportTotalProf').innerText = `Ksh ${globalProfit.toLocaleString()}`;
            document.getElementById('todayRev').innerText = `Ksh ${todayRevenue.toLocaleString()}`;
            document.getElementById('totalTrans').innerText = sales.length.toLocaleString();
            
            if (!filteredSales.length) {
                body.innerHTML = `<tr><td colspan="5" class="py-20 text-center text-slate-300 font-bold italic">No records found for this period.</td></tr>`;
            }
        };

        window.exportCSV = () => {
            if (!sales.length) return;
            let csv = "Timestamp,Item,Qty,SellPrice,Revenue,Profit\n";
            sales.forEach(s => {
                csv += `"${s.timestamp.toISOString()}","${s.name}",${s.qty},${s.price},${s.totalPrice},${s.profit}\n`;
            });
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Panasonic_Fin_Report_${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
        };

        // BOOTSTRAP
        window.onload = init;
