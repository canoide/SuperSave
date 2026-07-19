import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LogOut, Search, Plus, Trash2, CheckCircle, MapPin,
  ShoppingCart, Sparkles, Check, RefreshCw, AlertCircle,
  User, Lock, Edit, ClipboardList, ChevronRight, X, Eye, HelpCircle
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Html5QrcodeScanner } from 'html5-qrcode';
import L from 'leaflet';

// Fix Leaflet marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000';

export default function UserDashboard() {
  const navigate = useNavigate();
  const [token, setToken] = useState('');
  const [currentUser, setCurrentUser] = useState(null);

  // Active Screen: 'lists' | 'browser' | 'profile'
  const [activeScreen, setActiveScreen] = useState('lists');

  // General App Data
  const [stores, setStores] = useState([]);
  const [allProducts, setAllProducts] = useState([]); // Approved products for autocomplete

  // 1. SHOPPING LISTS MANAGEMENT (localStorage-backed)
  const [savedLists, setSavedLists] = useState([]);
  const [activeList, setActiveList] = useState(null); // The current active list object { id, name, items: [...] }
  const [newListName, setNewListName] = useState('');
  const [isCreateListOpen, setIsCreateListOpen] = useState(false);

  // Autocomplete search states
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [isAutocompleteOpen, setIsAutocompleteOpen] = useState(false);

  // 2. PRODUCT DETAIL / HISTORY MODAL
  const [selectedProduct, setSelectedProduct] = useState(null); // Product object for detail view
  const [detailStoreId, setDetailStoreId] = useState('');
  const [detailStorePrice, setDetailStorePrice] = useState(null);
  const [detailProductPrices, setDetailProductPrices] = useState([]);
  const [detailPriceHistory, setDetailPriceHistory] = useState([]);
  const [detailProposedPrice, setDetailProposedPrice] = useState('');

  // 3. RECOMMEND NEW PRODUCT MODAL (POPUP)
  const [isRecommendOpen, setIsRecommendOpen] = useState(false);
  const [recommendForm, setRecommendForm] = useState({
    title: '',
    description: '',
    barcode_qr: '',
    image_url: '',
  });

  // 4. OPTIMIZER STATE
  const [maxStores, setMaxStores] = useState(2);
  const [optimizationResult, setOptimizationResult] = useState(null);
  const [checkedOffProducts, setCheckedOffProducts] = useState({}); // { storeId_productId: boolean }
  const [optimizing, setOptimizing] = useState(false);

  // 5. PROFILE SCREEN STATE
  const [profileEmail, setProfileEmail] = useState('');
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Camera Scanner State
  const [isScannerActive, setIsScannerActive] = useState(false);
  const [scanError, setScanError] = useState('');
  const qrScannerRef = useRef(null);

  const [message, setMessage] = useState({ text: '', type: '' });

  // Load user data & saved lists on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (!storedToken || !storedUser) {
      navigate('/login');
      return;
    }

    const tokenVal = storedToken;
    const userVal = JSON.parse(storedUser);
    setToken(tokenVal);
    setCurrentUser(userVal);
    setProfileEmail(userVal.email);

    // Load lists from localStorage
    const storedLists = localStorage.getItem('ahorro_super_lists');
    if (storedLists) {
      const parsed = JSON.parse(storedLists);
      setSavedLists(parsed);
      if (parsed.length > 0) {
        setActiveList(parsed[0]);
      }
    }
  }, [navigate]);

  useEffect(() => {
    if (token) {
      fetchStores();
      fetchApprovedProducts();
    }
  }, [token]);

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 5000);
  };

  // FETCH UTILITIES
  const fetchStores = async () => {
    try {
      const res = await fetch(`${API_URL}/api/products/stores`);
      if (res.ok) {
        const data = await res.json();
        setStores(data);
        if (data.length > 0) {
          setDetailStoreId(data[0]._id);
        }
      }
    } catch (err) {
      console.error('Error fetching stores:', err);
    }
  };

  const fetchApprovedProducts = async () => {
    try {
      const res = await fetch(`${API_URL}/api/products/list`);
      if (res.ok) {
        const data = await res.json();
        setAllProducts(data);
      }
    } catch (err) {
      console.error('Error listing approved products:', err);
    }
  };

  // LOCAL STORAGE LIST PERSISTENCE UTILITIES
  const persistLists = (updatedLists) => {
    setSavedLists(updatedLists);
    localStorage.setItem('ahorro_super_lists', JSON.stringify(updatedLists));
  };

  const handleCreateList = (e) => {
    e.preventDefault();
    if (!newListName.trim()) return;

    const newList = {
      id: 'list_' + Date.now(),
      name: newListName.trim(),
      items: [],
      createdAt: new Date().toISOString(),
    };

    const updated = [newList, ...savedLists];
    persistLists(updated);
    setActiveList(newList);
    setNewListName('');
    setIsCreateListOpen(false);
    showMessage(`Lista "${newList.name}" creada con éxito.`);
  };

  const handleDeleteList = (listId, e) => {
    e.stopPropagation();
    if (!window.confirm('¿Deseas eliminar esta lista?')) return;

    const updated = savedLists.filter(l => l.id !== listId);
    persistLists(updated);

    if (activeList && activeList.id === listId) {
      setActiveList(updated.length > 0 ? updated[0] : null);
      setOptimizationResult(null);
    }
    showMessage('Lista eliminada.');
  };

  const handleSelectList = (list) => {
    setActiveList(list);
    setOptimizationResult(null);
    setCheckedOffProducts({});
  };

  // ADDING PRODUCTS TO ACTIVE LIST
  const handleAddProductToList = (product) => {
    if (!activeList) {
      showMessage('Por favor, arma o selecciona una lista de compras primero.', 'error');
      return;
    }

    if (activeList.items.some(item => item._id === product._id)) {
      showMessage('El producto ya está en tu lista.', 'error');
      return;
    }

    const updatedItems = [...activeList.items, product];
    const updatedList = { ...activeList, items: updatedItems };

    const updatedLists = savedLists.map(l => l.id === activeList.id ? updatedList : l);
    persistLists(updatedLists);
    setActiveList(updatedList);
    setProductSearchQuery('');
    setIsAutocompleteOpen(false);
    showMessage(`Se agregó "${product.title}" a la lista.`);
  };

  const handleRemoveProductFromList = (productId) => {
    if (!activeList) return;

    const updatedItems = activeList.items.filter(item => item._id !== productId);
    const updatedList = { ...activeList, items: updatedItems };

    const updatedLists = savedLists.map(l => l.id === activeList.id ? updatedList : l);
    persistLists(updatedLists);
    setActiveList(updatedList);

    // Clear checked state
    const cleanChecked = { ...checkedOffProducts };
    Object.keys(cleanChecked).forEach(key => {
      if (key.endsWith(`_${productId}`)) {
        delete cleanChecked[key];
      }
    });
    setCheckedOffProducts(cleanChecked);
  };

  // DYNAMIC AUTOCOMPLETE SEARCH FILTERING
  const filteredProducts = productSearchQuery.trim()
    ? allProducts.filter(p =>
        p.title.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
        p.barcode_qr.includes(productSearchQuery)
      )
    : [];

  // OPEN PRODUCT DETAILS MODAL (fetching prices & histories)
  const handleOpenProductDetail = async (product) => {
    setSelectedProduct(product);
    setDetailProductPrices([]);
    setDetailPriceHistory([]);
    setDetailProposedPrice('');

    try {
      const res = await fetch(`${API_URL}/api/products/${product.barcode_qr}`);
      if (res.ok) {
        const data = await res.json();
        setDetailProductPrices(data.prices);

        if (stores.length > 0) {
          // Default to first store in general list, or check if product has a price there
          const defaultStoreId = data.prices[0]?.store?._id || stores[0]._id;
          setDetailStoreId(defaultStoreId);
          loadPriceHistoryForStore(product._id, defaultStoreId, data.prices);
        }
      }
    } catch (err) {
      console.error('Error fetching product details:', err);
    }
  };

  const loadPriceHistoryForStore = async (productId, storeId, pricesList = detailProductPrices) => {
    // Determine active price
    const match = pricesList.find(p => p.store && p.store._id === storeId);
    setDetailStorePrice(match ? match.price : null);

    try {
      const res = await fetch(`${API_URL}/api/products/history/${productId}/${storeId}`);
      if (res.ok) {
        const data = await res.json();
        const formatted = data.map(h => ({
          date: new Date(h.updated_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }),
          precio: h.price,
        }));
        setDetailPriceHistory(formatted);
      } else {
        setDetailPriceHistory([]);
      }
    } catch (err) {
      console.error('Error fetching price history:', err);
      setDetailPriceHistory([]);
    }
  };

  // Monitor store dropdown in Product Detail Popup
  useEffect(() => {
    if (selectedProduct && detailStoreId) {
      loadPriceHistoryForStore(selectedProduct._id, detailStoreId);
    }
  }, [detailStoreId, selectedProduct]);

  // Submit Price Update Suggestion
  const handleSuggestPrice = async (e) => {
    e.preventDefault();
    if (!selectedProduct || !detailStoreId || !detailProposedPrice) {
      showMessage('Por favor, ingresa un precio para sugerir.', 'error');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/prices/suggest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          product_id: selectedProduct._id,
          store_id: detailStoreId,
          proposed_price: Number(detailProposedPrice),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        showMessage('Propuesta de precio registrada para moderación del admin.');
        setDetailProposedPrice('');
        setSelectedProduct(null); // Close modal
      } else {
        showMessage(data.error || 'Error al proponer precio', 'error');
      }
    } catch (err) {
      showMessage('Error de conexión', 'error');
    }
  };

  // Submit Recommended New Product
  const handleOpenRecommendModal = () => {
    setRecommendForm({
      title: productSearchQuery.trim(),
      description: '',
      barcode_qr: /^\d+$/.test(productSearchQuery) ? productSearchQuery : '',
      image_url: '',
    });
    setIsRecommendOpen(true);
  };

  const handleSuggestProduct = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/api/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(recommendForm),
      });

      const data = await res.json();
      if (res.ok) {
        showMessage('¡Gracias! Tu recomendación quedó registrada para aprobación del admin.');
        setIsRecommendOpen(false);
        setProductSearchQuery('');
      } else {
        showMessage(data.error || 'Error al sugerir el producto', 'error');
      }
    } catch (err) {
      showMessage('Error al conectar con el servidor', 'error');
    }
  };

  // OPTIMIZE LIST
  const handleOptimizeCart = async () => {
    if (!activeList || activeList.items.length === 0) {
      showMessage('La lista de compras activa está vacía.', 'error');
      return;
    }

    setOptimizing(true);
    setOptimizationResult(null);
    setCheckedOffProducts({});

    try {
      const res = await fetch(`${API_URL}/api/cart/optimize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          product_ids: activeList.items.map(item => item._id),
          max_stores: maxStores,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setOptimizationResult(data);
        showMessage('Plan óptimo calculado con éxito.');
      } else {
        showMessage(data.error || 'Error al optimizar lista', 'error');
      }
    } catch (err) {
      showMessage('Error de comunicación con el optimizador', 'error');
    } finally {
      setOptimizing(false);
    }
  };

  const handleToggleProductChecked = (storeId, productId) => {
    const key = `${storeId}_${productId}`;
    setCheckedOffProducts(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // CAMERA SCANNER HANDLERS
  const toggleHtml5Scanner = () => {
    if (isScannerActive) {
      if (qrScannerRef.current) {
        qrScannerRef.current.clear().catch(err => console.error(err));
      }
      setIsScannerActive(false);
    } else {
      setIsScannerActive(true);
      setScanError('');
      setTimeout(() => {
        const scanner = new Html5QrcodeScanner(
          'qr-reader-element-user',
          { fps: 10, qrbox: { width: 250, height: 250 } },
          false
        );

        scanner.render(
          async (decodedText) => {
            scanner.clear().catch(err => console.error(err));
            setIsScannerActive(false);

            // Search product details directly
            try {
              const res = await fetch(`${API_URL}/api/products/${decodedText}`);
              const data = await res.json();
              if (res.ok) {
                handleOpenProductDetail(data.product);
              } else {
                // If not found, open recommendation popup with barcode pre-filled
                setProductSearchQuery(decodedText);
                setRecommendForm({
                  title: '',
                  description: '',
                  barcode_qr: decodedText,
                  image_url: '',
                });
                setIsRecommendOpen(true);
                showMessage('El producto no está registrado. Puedes sugerirlo ahora.', 'error');
              }
            } catch (err) {
              setScanError('Error de red al escanear.');
            }
          },
          (errorMessage) => {}
        );

        qrScannerRef.current = scanner;
      }, 100);
    }
  };

  // PROFILE UPDATES
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/api/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email: profileEmail }),
      });
      const data = await res.json();
      if (res.ok) {
        showMessage('Perfil actualizado exitosamente.');
        localStorage.setItem('user', JSON.stringify(data.user));
        setCurrentUser(data.user);
      } else {
        showMessage(data.error || 'Error al actualizar perfil', 'error');
      }
    } catch (err) {
      showMessage('Error de red al actualizar perfil', 'error');
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showMessage('Las contraseñas nuevas no coinciden.', 'error');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/auth/change-password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showMessage('Contraseña cambiada de forma segura.');
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        showMessage(data.error || 'Error al cambiar contraseña', 'error');
      }
    } catch (err) {
      showMessage('Error de red al cambiar contraseña', 'error');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-16 md:pb-0 font-sans">

      {/* Top Mobile Header */}
      <header className="bg-emerald-600 text-white px-4 py-3 sticky top-0 z-30 shadow flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="text-xl">🛒</span>
          <span className="font-black tracking-tight text-lg">Ahorro Súper</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleHtml5Scanner}
            className="p-1.5 bg-emerald-700 hover:bg-emerald-800 rounded-full text-white transition shadow-inner"
            title="Escanear Código de Barras"
          >
            <RefreshCw size={16} />
          </button>
          <button
            onClick={handleLogout}
            className="p-1.5 bg-emerald-700 hover:bg-emerald-800 rounded-full text-white transition"
            title="Cerrar Sesión"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Global Alert Notification */}
      {message.text && (
        <div className="fixed top-14 left-0 right-0 z-50 px-4 py-2">
          <div className={`p-3 rounded-lg shadow-lg border ${
            message.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          } flex items-center gap-2 max-w-md mx-auto text-xs font-semibold`}>
            {message.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
            <span>{message.text}</span>
          </div>
        </div>
      )}

      {/* Active Scanner Panel popup inside the app */}
      {isScannerActive && (
        <div className="fixed inset-0 z-50 bg-black/90 p-4 flex flex-col justify-center items-center">
          <div className="max-w-md w-full bg-slate-900 rounded-2xl p-4 text-white text-center space-y-4 shadow-2xl relative">
            <button
              onClick={() => {
                if (qrScannerRef.current) qrScannerRef.current.clear();
                setIsScannerActive(false);
              }}
              className="absolute top-3 right-3 text-gray-400 hover:text-white p-1"
            >
              <X size={20} />
            </button>
            <h3 className="font-black text-emerald-500 flex items-center justify-center gap-2">
              <RefreshCw className="animate-spin" size={16} /> Escaneando Código de Barras...
            </h3>
            <p className="text-xs text-gray-400">Enfoca el código QR o código de barras de un producto en la cámara.</p>
            <div id="qr-reader-element-user" className="w-full rounded-xl overflow-hidden bg-black border border-gray-800"></div>
            {scanError && <p className="text-xs text-red-400 font-bold">{scanError}</p>}
          </div>
        </div>
      )}

      {/* Main Responsive Grid layout */}
      <main className="flex-1 max-w-md md:max-w-4xl w-full mx-auto p-4 space-y-6">

        {/* SCREEN 1: LISTAS (ARMADO Y HISTORIAL) */}
        {activeScreen === 'lists' && (
          <div className="space-y-6">

            {/* Create list / Header card */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 text-center space-y-4">
              <ClipboardList size={40} className="mx-auto text-emerald-600" />
              <div>
                <h2 className="text-xl font-extrabold text-slate-800">¿Qué compras haremos hoy?</h2>
                <p className="text-xs text-slate-500 mt-1">Arma una lista de compras rápida o recupera una anterior.</p>
              </div>

              {!isCreateListOpen ? (
                <button
                  onClick={() => setIsCreateListOpen(true)}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-bold text-sm shadow flex items-center justify-center gap-2 transition"
                >
                  <Plus size={16} /> Armar una nueva lista
                </button>
              ) : (
                <form onSubmit={handleCreateList} className="space-y-3">
                  <input
                    type="text"
                    required
                    placeholder="Ej. Súper del mes, Asado familiar"
                    className="w-full border border-slate-300 p-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900"
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setIsCreateListOpen(false)}
                      className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 py-2 rounded-xl text-xs font-bold transition"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-xl text-xs font-bold transition shadow"
                    >
                      Crear Lista
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* LIST BUILDER PANEL (shown if active list exists) */}
            {activeList ? (
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-4">

                {/* Active List Header */}
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <div>
                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Lista Activa</span>
                    <h3 className="font-black text-slate-900 text-lg">{activeList.name}</h3>
                  </div>
                  <button
                    onClick={(e) => handleDeleteList(activeList.id, e)}
                    className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition"
                    title="Borrar Lista"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {/* Autocomplete Product Search */}
                <div className="space-y-1.5 relative">
                  <label className="block text-xs font-bold text-slate-700">Agregar productos a tu lista:</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Buscar producto por nombre o código..."
                      className="w-full border border-slate-300 pl-9 pr-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900"
                      value={productSearchQuery}
                      onChange={(e) => {
                        setProductSearchQuery(e.target.value);
                        setIsAutocompleteOpen(true);
                      }}
                      onFocus={() => setIsAutocompleteOpen(true)}
                    />
                    <Search className="absolute left-3 top-3.5 text-slate-400" size={16} />
                    {productSearchQuery && (
                      <button
                        onClick={() => {
                          setProductSearchQuery('');
                          setIsAutocompleteOpen(false);
                        }}
                        className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>

                  {/* Dynamic Autocomplete Dropdown */}
                  {isAutocompleteOpen && productSearchQuery.trim().length > 0 && (
                    <div className="absolute left-0 right-0 bg-white border border-slate-200 mt-1 rounded-xl shadow-xl z-20 max-h-60 overflow-y-auto divide-y divide-slate-100">

                      {filteredProducts.map(p => (
                        <div
                          key={p._id}
                          onClick={() => handleAddProductToList(p)}
                          className="p-3 hover:bg-slate-50 flex items-center justify-between gap-3 cursor-pointer text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {p.image_url && (
                              <img src={p.image_url} alt={p.title} className="w-8 h-8 rounded object-cover flex-shrink-0 bg-slate-100" />
                            )}
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900 truncate">{p.title}</p>
                              <span className="text-[9px] font-mono text-slate-500">Cód: {p.barcode_qr}</span>
                            </div>
                          </div>
                          <button className="p-1 bg-emerald-50 text-emerald-600 rounded">
                            <Plus size={14} />
                          </button>
                        </div>
                      ))}

                      {filteredProducts.length === 0 && (
                        <div className="p-4 text-center space-y-3">
                          <p className="text-xs text-slate-500 font-semibold">No se encontraron productos registrados.</p>
                          <button
                            type="button"
                            onClick={handleOpenRecommendModal}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-lg shadow-sm transition"
                          >
                            💡 Recomendar / Sugerir Producto
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Loaded products in list checklist */}
                <div className="space-y-2">
                  <span className="block text-xs font-bold text-slate-700">Productos en la lista ({activeList.items.length}):</span>
                  {activeList.items.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-xs">
                      <ShoppingCart size={32} className="mx-auto text-slate-300 mb-1" />
                      Tu lista está vacía. ¡Busca y agrega arriba para empezar!
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                      {activeList.items.map(item => (
                        <div key={item._id} className="p-3 bg-white flex items-center justify-between gap-3 hover:bg-slate-50 transition">
                          <div
                            onClick={() => handleOpenProductDetail(item)}
                            className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                            title="Ver histórico de precios"
                          >
                            {item.image_url && (
                              <img src={item.image_url} alt={item.title} className="w-10 h-10 rounded object-cover bg-slate-100" />
                            )}
                            <div className="min-w-0">
                              <p className="font-extrabold text-sm text-slate-900 truncate flex items-center gap-1 hover:text-emerald-600">
                                {item.title} <Eye size={12} className="text-slate-400" />
                              </p>
                              <span className="text-[10px] text-slate-500 font-mono">Código: {item.barcode_qr}</span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleRemoveProductFromList(item._id)}
                            className="text-slate-400 hover:text-red-500 p-1 rounded hover:bg-slate-100 transition"
                            title="Eliminar"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Optimization controls */}
                {activeList.items.length > 0 && (
                  <div className="border-t border-slate-100 pt-4 space-y-3">
                    <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                      <span>Cantidad máxima de tiendas:</span>
                      <span className="text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 rounded-full text-xs">
                        {maxStores} {maxStores === 1 ? 'tienda' : 'tiendas'}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="3"
                      className="w-full accent-emerald-600 cursor-pointer"
                      value={maxStores}
                      onChange={(e) => setMaxStores(Number(e.target.value))}
                    />
                    <button
                      onClick={handleOptimizeCart}
                      disabled={optimizing}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-bold shadow transition flex items-center justify-center gap-2 text-sm"
                    >
                      <Sparkles size={16} />
                      {optimizing ? 'Optimizando compras...' : 'Optimizar dónde comprar'}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400 text-sm">
                No tienes ninguna lista activa. Crea una para empezar.
              </div>
            )}

            {/* LISTS HISTORICAL LOG / LISTS DIRECTORY AT BOTTOM */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-3">
              <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-1.5">
                📁 Historial de Listas Creadas
              </h3>

              {savedLists.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">No tienes listas anteriores guardadas en tu celular.</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {savedLists.map((list) => {
                    const isActive = activeList && activeList.id === list.id;
                    return (
                      <div
                        key={list.id}
                        onClick={() => handleSelectList(list)}
                        className={`p-3 rounded-xl border transition flex items-center justify-between cursor-pointer ${
                          isActive
                            ? 'border-emerald-600 bg-emerald-50/50'
                            : 'border-slate-100 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <div className="min-w-0">
                          <h4 className="font-bold text-sm text-slate-900 truncate">{list.name}</h4>
                          <span className="text-[10px] text-slate-500 block mt-0.5">
                            {list.items.length} productos • {new Date(list.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {isActive && <span className="bg-emerald-600 text-white font-extrabold text-[9px] px-2 py-0.5 rounded uppercase">Activa</span>}
                          <button
                            onClick={(e) => handleDeleteList(list.id, e)}
                            className="text-slate-400 hover:text-red-500 p-1 hover:bg-slate-200 rounded transition"
                          >
                            <Trash2 size={14} />
                          </button>
                          <ChevronRight size={16} className="text-slate-400" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* OPTIMIZER SPLIT CART PLAN */}
            {optimizationResult && (
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-6">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-lg font-black text-slate-900">✨ Plan de Compra Sugerido</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Maximiza ahorro visitando un máximo de {maxStores} tiendas.</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400 font-bold block">Total Estimado</span>
                    <span className="text-xl font-black text-emerald-600">${optimizationResult.grand_total}</span>
                  </div>
                </div>

                <div className="space-y-4">
                  {optimizationResult.stores_to_visit.map((visit, index) => {
                    const store = visit.store;
                    return (
                      <div key={store._id} className="border border-slate-100 rounded-xl overflow-hidden shadow-sm bg-white">

                        {/* Store Header bar */}
                        <div className="bg-slate-50 p-3 border-b border-slate-100 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                          <div>
                            <span className="bg-indigo-600 text-white font-bold px-1.5 py-0.5 rounded text-[9px] uppercase mr-1.5 inline-block">
                              Parada {index + 1}
                            </span>
                            <strong className="text-slate-900 text-sm">{store.brand}</strong> - <span className="text-xs text-slate-600">{store.name}</span>
                            <p className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-0.5">
                              <MapPin size={10} className="text-slate-400" /> {store.address}
                            </p>
                          </div>
                          <div className="flex justify-between sm:text-right border-t sm:border-0 pt-2 sm:pt-0">
                            <span className="text-xs text-slate-500 block font-bold sm:hidden">Subtotal</span>
                            <span className="text-sm font-black text-emerald-600">${visit.subtotal}</span>
                          </div>
                        </div>

                        {/* Checklist */}
                        <div className="divide-y divide-slate-100 px-3">
                          {visit.products.map(p => {
                            const isChecked = checkedOffProducts[`${store._id}_${p.product_id}`];
                            return (
                              <div
                                key={p.product_id}
                                onClick={() => handleToggleProductChecked(store._id, p.product_id)}
                                className="py-2.5 flex items-center justify-between cursor-pointer hover:bg-slate-50/50"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className={`w-4.5 h-4.5 rounded border flex items-center justify-center transition-all ${
                                    isChecked ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 bg-white'
                                  }`}>
                                    {isChecked && <Check size={12} strokeWidth={3} />}
                                  </div>
                                  <span className={`text-xs font-semibold text-slate-900 truncate ${isChecked ? 'line-through text-slate-400 opacity-55' : ''}`}>
                                    {p.title}
                                  </span>
                                </div>
                                <span className={`text-xs font-black text-slate-800 ${isChecked ? 'line-through text-slate-400 opacity-55' : ''}`}>
                                  ${p.price}
                                </span>
                              </div>
                            );
                          })}
                        </div>

                        {/* Maps Link */}
                        <div className="bg-slate-50/50 p-2 text-right border-t border-slate-100">
                          <a
                            href={`https://www.google.com/maps/dir/?api=1&destination=${store.location.coordinates[1]},${store.location.coordinates[0]}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 bg-emerald-600 text-white font-bold text-[10px] px-3 py-1 rounded-md shadow-sm transition hover:bg-emerald-700"
                          >
                            <MapPin size={10} /> Ir a Góndola
                          </a>
                        </div>
                      </div>
                    );
                  })}

                  {/* Route Leaflet Map */}
                  <div className="space-y-2">
                    <span className="block text-xs font-bold text-slate-700">Ruta de Supermercados:</span>
                    <div className="h-60 rounded-xl border border-slate-200 overflow-hidden relative shadow-sm">
                      <MapContainer center={[-34.6037, -58.3816]} zoom={13} className="w-full h-full">
                        <TileLayer
                          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        {optimizationResult.stores_to_visit.map((visit, index) => (
                          <Marker
                            key={visit.store._id}
                            position={[visit.store.location.coordinates[1], visit.store.location.coordinates[0]]}
                          >
                            <Popup>
                              <div className="text-[11px]">
                                <strong className="text-indigo-600 font-bold">{visit.store.brand}</strong><br/>
                                Parada {index + 1} ({visit.products.length} productos)
                              </div>
                            </Popup>
                          </Marker>
                        ))}
                      </MapContainer>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SCREEN 2: BROWSER / SCANNER / EXPLORADOR DE PRECIOS */}
        {activeScreen === 'browser' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-4">
              <div className="text-center space-y-1">
                <Search size={36} className="mx-auto text-emerald-600" />
                <h3 className="text-lg font-extrabold text-slate-800">Explorador de Precios</h3>
                <p className="text-xs text-slate-500">Busca el histórico, precios y ofertas cargadas por la comunidad.</p>
              </div>

              {/* Camera Scanner Button */}
              <button
                onClick={toggleHtml5Scanner}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl text-xs font-bold shadow flex items-center justify-center gap-2 transition"
              >
                <RefreshCw size={14} /> Iniciar Escáner de Cámara
              </button>

              <div className="relative border-t border-slate-100 pt-4">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Escribe para buscar un producto:</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Ej. Leche Entera, Coca-Cola..."
                    className="w-full border border-slate-300 pl-9 pr-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900"
                    value={productSearchQuery}
                    onChange={(e) => setProductSearchQuery(e.target.value)}
                  />
                  <Search className="absolute left-3 top-3 text-slate-400" size={14} />
                </div>
              </div>

              {/* Product list browse results */}
              <div className="space-y-2">
                {productSearchQuery.trim() ? (
                  filteredProducts.length === 0 ? (
                    <div className="text-center py-6 space-y-3">
                      <p className="text-xs text-slate-500 font-semibold">No se encontraron productos registrados para la búsqueda.</p>
                      <button
                        type="button"
                        onClick={handleOpenRecommendModal}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-lg shadow-sm transition"
                      >
                        💡 Recomendar Nuevo Producto
                      </button>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                      {filteredProducts.map(p => (
                        <div
                          key={p._id}
                          onClick={() => handleOpenProductDetail(p)}
                          className="p-3 bg-white hover:bg-slate-50 flex items-center gap-3 cursor-pointer transition"
                        >
                          {p.image_url && (
                            <img src={p.image_url} alt={p.title} className="w-10 h-10 rounded object-cover bg-slate-100" />
                          )}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-sm text-slate-900 truncate">{p.title}</h4>
                            <span className="text-[10px] text-slate-500 font-mono">Cód: {p.barcode_qr}</span>
                          </div>
                          <ChevronRight size={16} className="text-slate-400" />
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  <div className="space-y-2">
                    <span className="block text-xs font-bold text-slate-700">Todos los productos registrados:</span>
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                      {allProducts.map(p => (
                        <div
                          key={p._id}
                          onClick={() => handleOpenProductDetail(p)}
                          className="p-3 hover:bg-slate-50 flex items-center gap-3 cursor-pointer transition"
                        >
                          {p.image_url && (
                            <img src={p.image_url} alt={p.title} className="w-10 h-10 rounded object-cover bg-slate-100" />
                          )}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-sm text-slate-900 truncate">{p.title}</h4>
                            <span className="text-[10px] text-slate-500 font-mono">Cód: {p.barcode_qr}</span>
                          </div>
                          <ChevronRight size={16} className="text-slate-400" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* SCREEN 3: CONFIGURACIONES DE USUARIO / PERFIL / CONTRASEÑA */}
        {activeScreen === 'profile' && (
          <div className="space-y-6">

            {/* View user details & Config email */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-lg">
                  {currentUser?.email?.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">{currentUser?.email}</h3>
                  <span className="bg-indigo-100 text-indigo-800 text-[9px] uppercase font-bold px-2 py-0.5 rounded-full">
                    Rol: {currentUser?.role}
                  </span>
                </div>
              </div>

              <form onSubmit={handleUpdateProfile} className="space-y-3">
                <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <User size={14} /> Modificar Correo Electrónico
                </h4>
                <input
                  type="email"
                  required
                  className="w-full border border-slate-300 p-2.5 rounded-xl text-sm text-slate-900"
                  value={profileEmail}
                  onChange={(e) => setProfileEmail(e.target.value)}
                />
                <button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-xl text-xs font-bold transition shadow"
                >
                  Guardar Correo
                </button>
              </form>
            </div>

            {/* Change Password Form */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-4">
              <h4 className="text-sm font-extrabold text-slate-800 flex items-center gap-1">
                <Lock size={16} className="text-emerald-600" /> Cambiar Contraseña Segura
              </h4>

              <form onSubmit={handleChangePassword} className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Contraseña Actual</label>
                  <input
                    type="password"
                    required
                    placeholder="Escribe tu contraseña actual"
                    className="w-full border border-slate-300 p-2.5 rounded-xl text-sm text-slate-900"
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nueva Contraseña</label>
                  <input
                    type="password"
                    required
                    placeholder="Elige una nueva contraseña segura"
                    className="w-full border border-slate-300 p-2.5 rounded-xl text-sm text-slate-900"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Confirmar Nueva Contraseña</label>
                  <input
                    type="password"
                    required
                    placeholder="Vuelve a escribir la nueva contraseña"
                    className="w-full border border-slate-300 p-2.5 rounded-xl text-sm text-slate-900"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl text-xs font-bold transition shadow"
                >
                  Actualizar Contraseña
                </button>
              </form>
            </div>
          </div>
        )}

      </main>

      {/* POPUP MODAL 1: RECOMMEND / SUGGEST NEW PRODUCT */}
      {isRecommendOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 p-4 flex items-center justify-center">
          <div className="max-w-md w-full bg-white rounded-2xl p-5 shadow-2xl space-y-4 relative text-xs">
            <button
              onClick={() => setIsRecommendOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
            >
              <X size={18} />
            </button>
            <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-1">
              💡 Recomendar Producto al Administrador
            </h3>
            <p className="text-slate-500">Carga los detalles para agregar un producto faltante al catálogo.</p>

            <form onSubmit={handleSuggestProduct} className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nombre del Producto</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Galletitas de Vainilla 110g"
                  className="w-full border border-slate-300 p-2 rounded-lg text-sm text-slate-900"
                  value={recommendForm.title}
                  onChange={(e) => setRecommendForm(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Descripción / Notas</label>
                <textarea
                  rows={2}
                  required
                  placeholder="Ej. Galletitas dulces crujientes con chips de chocolate"
                  className="w-full border border-slate-300 p-2 rounded-lg text-sm text-slate-900"
                  value={recommendForm.description}
                  onChange={(e) => setRecommendForm(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Código de Barras / QR</label>
                <input
                  type="text"
                  required
                  placeholder="77900..."
                  className="w-full border border-slate-300 p-2 rounded-lg text-sm text-slate-900 font-mono"
                  value={recommendForm.barcode_qr}
                  onChange={(e) => setRecommendForm(prev => ({ ...prev, barcode_qr: e.target.value }))}
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">URL de Imagen (opcional)</label>
                <input
                  type="url"
                  placeholder="https://..."
                  className="w-full border border-slate-300 p-2 rounded-lg text-sm text-slate-900"
                  value={recommendForm.image_url}
                  onChange={(e) => setRecommendForm(prev => ({ ...prev, image_url: e.target.value }))}
                />
              </div>
              <button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-bold shadow transition text-sm"
              >
                Enviar Recomendación
              </button>
            </form>
          </div>
        </div>
      )}

      {/* POPUP MODAL 2: PRODUCT DETAIL SHEET & HISTORICAL RECHARTS LINE GRAPH */}
      {selectedProduct && (
        <div className="fixed inset-0 z-40 bg-black/50 p-4 flex items-center justify-center">
          <div className="max-w-md w-full bg-white rounded-2xl p-5 shadow-2xl space-y-4 relative text-xs overflow-y-auto max-h-[90vh]">
            <button
              onClick={() => setSelectedProduct(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
            >
              <X size={18} />
            </button>

            <div className="flex items-start gap-3 border-b border-slate-100 pb-3">
              {selectedProduct.image_url && (
                <img src={selectedProduct.image_url} alt={selectedProduct.title} className="w-14 h-14 rounded-lg object-cover border bg-slate-50" />
              )}
              <div>
                <span className="bg-slate-100 text-slate-600 text-[8px] uppercase font-bold px-1.5 py-0.5 rounded-full">
                  Cód: {selectedProduct.barcode_qr}
                </span>
                <h3 className="font-extrabold text-slate-900 text-sm mt-0.5">{selectedProduct.title}</h3>
                <p className="text-[10px] text-slate-500">{selectedProduct.description}</p>
              </div>
            </div>

            {/* Price by Store selector & display */}
            <div className="space-y-3">
              <div className="flex gap-2.5">
                <div className="flex-1">
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Ver por Supermercado:</label>
                  <select
                    className="w-full border border-slate-300 p-1.5 rounded-lg text-xs text-slate-900"
                    value={detailStoreId}
                    onChange={(e) => setDetailStoreId(e.target.value)}
                  >
                    {stores.map(s => (
                      <option key={s._id} value={s._id}>{s.brand} - {s.name}</option>
                    ))}
                  </select>
                </div>
                <div className="w-1/3 bg-slate-50 border border-slate-200 p-1.5 rounded-lg text-center flex flex-col justify-center">
                  <span className="text-[9px] text-slate-500 font-bold block uppercase">Precio</span>
                  <span className="text-base font-black text-emerald-600">
                    {detailStorePrice !== null ? `$${detailStorePrice}` : 'N/A'}
                  </span>
                </div>
              </div>

              {/* Recharts Historical Graph */}
              {detailStorePrice !== null && detailPriceHistory.length > 0 ? (
                <div className="space-y-1.5">
                  <span className="block text-[10px] uppercase font-bold text-slate-500">Gráfico de Historial de Precios:</span>
                  <div className="w-full h-40 bg-slate-50 border border-slate-100 rounded-lg p-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={detailPriceHistory} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="2 2" vertical={false} />
                        <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                        <YAxis tick={{ fontSize: 9 }} />
                        <Tooltip contentStyle={{ fontSize: '10px' }} />
                        <Line type="monotone" dataKey="precio" stroke="#10b981" strokeWidth={2} activeDot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : (
                <p className="text-[10px] text-slate-400 bg-slate-50 p-3 rounded text-center">No hay registros de históricos de precios para esta sucursal.</p>
              )}

              {/* Crowd source price proposal */}
              <form onSubmit={handleSuggestPrice} className="border-t border-slate-100 pt-3 space-y-2">
                <label className="block text-[10px] uppercase font-bold text-slate-500">¿Viste otro precio en góndola? Sugerir:</label>
                <div className="flex gap-2">
                  <div className="relative rounded-md shadow-sm flex-1">
                    <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                      <span className="text-gray-400 text-xs">$</span>
                    </div>
                    <input
                      type="number"
                      step="any"
                      required
                      placeholder="Monto nuevo"
                      className="w-full border border-slate-300 pl-6 pr-2 py-1.5 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      value={detailProposedPrice}
                      onChange={(e) => setDetailProposedPrice(e.target.value)}
                    />
                  </div>
                  <button
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg shadow-sm transition"
                  >
                    Proponer
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-30 flex justify-around py-2.5 shadow-lg md:hidden">
        <button
          onClick={() => setActiveScreen('lists')}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold ${
            activeScreen === 'lists' ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <ClipboardList size={20} />
          <span>Mis Listas</span>
        </button>
        <button
          onClick={() => setActiveScreen('browser')}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold ${
            activeScreen === 'browser' ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <Search size={20} />
          <span>Explorador</span>
        </button>
        <button
          onClick={() => setActiveScreen('profile')}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold ${
            activeScreen === 'profile' ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <User size={20} />
          <span>Mi Cuenta</span>
        </button>
      </nav>

      {/* DESKTOP SIDEBAR OR TOP TABS (Responsive for md/lg devices) */}
      <div className="hidden md:flex bg-slate-100 border-b border-slate-200 justify-center gap-4 py-2 text-xs font-bold shadow-inner">
        <button
          onClick={() => setActiveScreen('lists')}
          className={`px-4 py-2 rounded-lg transition ${
            activeScreen === 'lists' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-200'
          }`}
        >
          📋 Mis Listas de Compras
        </button>
        <button
          onClick={() => setActiveScreen('browser')}
          className={`px-4 py-2 rounded-lg transition ${
            activeScreen === 'browser' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-200'
          }`}
        >
          🔍 Explorador de Precios
        </button>
        <button
          onClick={() => setActiveScreen('profile')}
          className={`px-4 py-2 rounded-lg transition ${
            activeScreen === 'profile' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-200'
          }`}
        >
          👤 Mi Cuenta & Seguridad
        </button>
      </div>

    </div>
  );
}
