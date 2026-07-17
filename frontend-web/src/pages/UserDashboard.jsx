import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LogOut, Search, Plus, Trash2, CheckCircle, MapPin,
  ShoppingCart, Filter, ArrowRight, Sparkles, Check, RefreshCw, AlertCircle
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Html5QrcodeScanner } from 'html5-qrcode';
import L from 'leaflet';

// Fix Leaflet marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

export default function UserDashboard() {
  const navigate = useNavigate();
  const [token, setToken] = useState('');
  const [currentUser, setCurrentUser] = useState(null);

  // General App Data
  const [stores, setStores] = useState([]);
  const [allProducts, setAllProducts] = useState([]); // Approved products for the list builder

  // 1. SCANNER & MANUAL SEARCH STATE
  const [barcodeQuery, setBarcodeQuery] = useState('');
  const [foundProduct, setFoundProduct] = useState(null);
  const [foundProductPrices, setFoundProductPrices] = useState([]); // Prices from barcode get
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [selectedStorePrice, setSelectedStorePrice] = useState(null);
  const [priceHistory, setPriceHistory] = useState([]);
  const [proposedPrice, setProposedPrice] = useState('');
  const [scanError, setScanError] = useState('');
  const [isScannerActive, setIsScannerActive] = useState(false);

  // New Product Suggestion Form
  const [newProductForm, setNewProductForm] = useState({
    title: '',
    description: '',
    barcode_qr: '',
    image_url: '',
  });

  // 2. SHOPPING LIST (LOCAL CART) STATE
  const [cart, setCart] = useState([]); // List of products
  const [maxStores, setMaxStores] = useState(2);
  const [optimizationResult, setOptimizationResult] = useState(null);
  const [checkedOffProducts, setCheckedOffProducts] = useState({}); // { storeId_productId: boolean }

  const [message, setMessage] = useState({ text: '', type: '' });
  const [loading, setLoading] = useState(false);

  const qrScannerRef = useRef(null);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (!storedToken || !storedUser) {
      navigate('/login');
      return;
    }

    setToken(storedToken);
    setCurrentUser(JSON.parse(storedUser));
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
      const res = await fetch('http://127.0.0.1:5000/api/products/stores');
      if (res.ok) {
        const data = await res.json();
        setStores(data);
        if (data.length > 0) {
          setSelectedStoreId(data[0]._id);
        }
      }
    } catch (err) {
      console.error('Error fetching stores:', err);
    }
  };

  const fetchApprovedProducts = async () => {
    try {
      const res = await fetch('http://127.0.0.1:5000/api/products/list');
      if (res.ok) {
        const data = await res.json();
        setAllProducts(data);
      }
    } catch (err) {
      console.error('Error listing approved products:', err);
    }
  };

  // 1. PRODUCT SEARCH AND CAMERA SCANNING
  const handleBarcodeSearch = async (code) => {
    setScanError('');
    setFoundProduct(null);
    setFoundProductPrices([]);
    setSelectedStorePrice(null);
    setPriceHistory([]);

    const actualCode = code || barcodeQuery;
    if (!actualCode) {
      setScanError('Por favor, ingresa o escanea un código de barras.');
      return;
    }

    try {
      const res = await fetch(`http://127.0.0.1:5000/api/products/${actualCode}`);
      const data = await res.json();

      if (!res.ok) {
        setScanError(data.error || 'Producto no encontrado');
        return;
      }

      setFoundProduct(data.product);
      setFoundProductPrices(data.prices);

      // Trigger load of prices and histories for default selected store if possible
      if (selectedStoreId) {
        loadPriceDetailsForStore(data.product._id, selectedStoreId, data.prices);
      }
    } catch (err) {
      setScanError('Error al buscar el producto. Revisa tu conexión.');
    }
  };

  const loadPriceDetailsForStore = async (productId, storeId, pricesList = foundProductPrices) => {
    // 1. Find price from the direct barcode endpoint payload
    const priceObj = pricesList.find(p => p.store && p.store._id === storeId);
    setSelectedStorePrice(priceObj ? priceObj.price : null);

    // 2. Fetch history for Recharts
    try {
      const res = await fetch(`http://127.0.0.1:5000/api/products/history/${productId}/${storeId}`);
      if (res.ok) {
        const data = await res.json();
        // format data for recharts (e.g. transform ISO dates to readable string)
        const formatted = data.map(h => ({
          date: new Date(h.updated_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }),
          precio: h.price,
        }));
        setPriceHistory(formatted);
      } else {
        setPriceHistory([]);
      }
    } catch (err) {
      console.error('Error loading price history:', err);
      setPriceHistory([]);
    }
  };

  // Monitor store select in product details
  useEffect(() => {
    if (foundProduct && selectedStoreId) {
      loadPriceDetailsForStore(foundProduct._id, selectedStoreId);
    }
  }, [selectedStoreId, foundProduct]);

  // Suggest Price Update
  const handleSuggestPrice = async (e) => {
    e.preventDefault();
    if (!foundProduct || !selectedStoreId || !proposedPrice) {
      showMessage('Faltan campos obligatorios para proponer precio.', 'error');
      return;
    }

    try {
      const res = await fetch('http://127.0.0.1:5000/api/prices/suggest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          product_id: foundProduct._id,
          store_id: selectedStoreId,
          proposed_price: Number(proposedPrice),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        showMessage('Sugerencia de precio enviada con éxito. Queda en revisión del admin.');
        setProposedPrice('');
      } else {
        showMessage(data.error || 'Error al proponer precio', 'error');
      }
    } catch (err) {
      showMessage('Error de conexión', 'error');
    }
  };

  // Suggest New Product (completely new)
  const handleSuggestProduct = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('http://127.0.0.1:5000/api/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newProductForm),
      });

      const data = await res.json();
      if (res.ok) {
        showMessage('Sugerencia de producto registrada. El administrador la revisará pronto.');
        setNewProductForm({
          title: '',
          description: '',
          barcode_qr: '',
          image_url: '',
        });
      } else {
        showMessage(data.error || 'Error al sugerir producto', 'error');
      }
    } catch (err) {
      showMessage('Error al conectar con el servidor', 'error');
    }
  };

  // 2. SHOPPING LIST ACTIONS
  const handleAddProductToCart = (prodId) => {
    const prod = allProducts.find(p => p._id === prodId);
    if (!prod) return;

    if (cart.some(item => item._id === prod._id)) {
      showMessage('El producto ya está en tu lista.', 'error');
      return;
    }

    setCart(prev => [...prev, prod]);
    showMessage(`Se agregó "${prod.title}" a tu lista de compras.`);
  };

  const handleRemoveFromCart = (prodId) => {
    setCart(prev => prev.filter(p => p._id !== prodId));
    // Reset checked off state
    const cleanChecked = { ...checkedOffProducts };
    Object.keys(cleanChecked).forEach(key => {
      if (key.endsWith(`_${prodId}`)) {
        delete cleanChecked[key];
      }
    });
    setCheckedOffProducts(cleanChecked);
  };

  // OPTIMIZE CART HANDLER
  const handleOptimizeCart = async () => {
    if (cart.length === 0) {
      showMessage('Tu lista de compras está vacía.', 'error');
      return;
    }

    setLoading(true);
    setOptimizationResult(null);
    setCheckedOffProducts({});

    try {
      const res = await fetch('http://127.0.0.1:5000/api/cart/optimize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          product_ids: cart.map(item => item._id),
          max_stores: maxStores,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setOptimizationResult(data);
        showMessage('Optimización calculada. Revisa el plan de compra más abajo.');
      } else {
        showMessage(data.error || 'Error al optimizar tu carrito', 'error');
      }
    } catch (err) {
      showMessage('Error de conexión con el optimizador', 'error');
    } finally {
      setLoading(false);
    }
  };

  // CHECKBOX TOGGLE FOR GONDOLA PROGRESS
  const handleToggleProductChecked = (storeId, productId) => {
    const key = `${storeId}_${productId}`;
    setCheckedOffProducts(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // SCANNER START/STOP
  const toggleHtml5Scanner = () => {
    if (isScannerActive) {
      if (qrScannerRef.current) {
        qrScannerRef.current.clear().catch(err => console.error(err));
      }
      setIsScannerActive(false);
    } else {
      setIsScannerActive(true);
      setTimeout(() => {
        const scanner = new Html5QrcodeScanner(
          'qr-reader-element',
          { fps: 10, qrbox: { width: 250, height: 250 } },
          /* verbose= */ false
        );

        scanner.render(
          (decodedText) => {
            // Success callback
            setBarcodeQuery(decodedText);
            handleBarcodeSearch(decodedText);
            scanner.clear().catch(err => console.error(err));
            setIsScannerActive(false);
          },
          (errorMessage) => {
            // Silence error messages to avoid console clutter
          }
        );

        qrScannerRef.current = scanner;
      }, 100);
    }
  };

  // Stop scanner on unmount
  useEffect(() => {
    return () => {
      if (qrScannerRef.current) {
        qrScannerRef.current.clear().catch(err => console.error(err));
      }
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* User Navbar */}
      <nav className="bg-emerald-600 text-white shadow-md px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ahorro Súper 🛒</h1>
          <p className="text-xs text-emerald-100">Portal del Ahorrista: {currentUser?.email}</p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 transition text-white px-4 py-2 rounded-lg text-sm font-medium shadow"
        >
          <LogOut size={16} />
          Cerrar Sesión
        </button>
      </nav>

      {/* Main Content Container */}
      <div className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-8">

        {/* Global Alert Notification */}
        {message.text && (
          <div className={`p-4 rounded-lg shadow border ${
            message.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          } transition-all duration-300 flex items-center gap-2`}>
            {message.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
            <span className="font-semibold text-sm">{message.text}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* LEFT COLUMN: BARCODE SCANNER & CROWDSOURCING & NEW PRODUCT */}
          <div className="space-y-6">

            {/* ESCANER DE QR/BARRAS Y BUSQUEDA */}
            <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100 space-y-4">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                📷 Escáner de QR / Código de Barras
              </h2>
              <p className="text-xs text-gray-500">
                Escanea el código de barras de un producto para ver sus precios y evolución histórica, o proponer cambios.
              </p>

              {/* Live camera toggle */}
              <div className="flex gap-2">
                <button
                  onClick={toggleHtml5Scanner}
                  className={`flex-1 py-2 px-4 rounded-lg text-xs font-bold text-white transition flex items-center justify-center gap-2 shadow ${
                    isScannerActive ? 'bg-red-500 hover:bg-red-600' : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  <RefreshCw size={14} className={isScannerActive ? 'animate-spin' : ''} />
                  {isScannerActive ? 'Detener Cámara' : 'Iniciar Escáner con Cámara'}
                </button>
              </div>

              {/* Scanner HTML Container */}
              {isScannerActive && (
                <div className="border border-gray-300 rounded-lg p-2 bg-black overflow-hidden shadow-inner">
                  <div id="qr-reader-element" className="w-full"></div>
                </div>
              )}

              {/* Manual Entry Fallback */}
              <div className="flex gap-2 pt-2">
                <input
                  type="text"
                  placeholder="O ingresa el código manual (ej. 7790040111111)"
                  className="flex-1 border border-gray-300 px-3 py-1.5 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  value={barcodeQuery}
                  onChange={(e) => setBarcodeQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleBarcodeSearch()}
                />
                <button
                  onClick={() => handleBarcodeSearch()}
                  className="bg-gray-800 hover:bg-gray-900 text-white px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition shadow"
                >
                  <Search size={14} /> Buscar
                </button>
              </div>

              {scanError && (
                <p className="text-xs text-red-600 font-semibold bg-red-50 p-2 rounded border border-red-100 flex items-center gap-1">
                  ⚠️ {scanError}
                </p>
              )}

              {/* Search Result Sheet */}
              {foundProduct && (
                <div className="border border-gray-100 rounded-lg p-4 bg-gray-50 space-y-4">
                  <div className="flex items-start gap-3">
                    {foundProduct.image_url && (
                      <img
                        src={foundProduct.image_url}
                        alt={foundProduct.title}
                        className="w-20 h-20 rounded-lg object-cover border border-gray-200 bg-white"
                      />
                    )}
                    <div className="flex-1">
                      <span className="inline-block bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full mb-1">
                        Código: {foundProduct.barcode_qr}
                      </span>
                      <h3 className="font-extrabold text-gray-950 text-base">{foundProduct.title}</h3>
                      <p className="text-xs text-gray-600 mt-1">{foundProduct.description}</p>
                    </div>
                  </div>

                  {/* Pricing and Crowdsourcing Form */}
                  <div className="border-t border-gray-200 pt-4 space-y-3">
                    <div className="flex flex-col sm:flex-row gap-3">

                      {/* Select Store */}
                      <div className="flex-1">
                        <label className="block text-xs font-bold text-gray-700 mb-1">Ver precio por sucursal:</label>
                        <select
                          className="w-full border border-gray-300 p-1.5 rounded-md text-xs text-gray-900"
                          value={selectedStoreId}
                          onChange={(e) => setSelectedStoreId(e.target.value)}
                        >
                          {stores.map(st => (
                            <option key={st._id} value={st._id}>{st.brand} - {st.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Display current Price */}
                      <div className="w-full sm:w-1/3 bg-white p-2 rounded-lg border border-gray-200 flex flex-col justify-center items-center text-center">
                        <span className="text-[10px] uppercase font-bold text-gray-500">Precio Actual</span>
                        <span className="text-xl font-black text-emerald-600">
                          {selectedStorePrice !== null ? `$${selectedStorePrice}` : 'N/A'}
                        </span>
                        {selectedStorePrice === null && (
                          <span className="text-[9px] text-red-500 font-semibold">Sin stock / Sin precio</span>
                        )}
                      </div>
                    </div>

                    {/* Price History Line Chart using Recharts */}
                    {selectedStorePrice !== null && priceHistory.length > 0 && (
                      <div className="space-y-1">
                        <span className="block text-xs font-bold text-gray-700">Historial de Precios en esta sucursal:</span>
                        <div className="w-full h-[180px] bg-white p-2 rounded-lg border border-gray-200">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={priceHistory} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} />
                              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                              <YAxis tick={{ fontSize: 10 }} />
                              <Tooltip contentStyle={{ fontSize: '11px' }} />
                              <Line
                                type="monotone"
                                dataKey="precio"
                                stroke="#10b981"
                                strokeWidth={2.5}
                                activeDot={{ r: 6 }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}

                    {/* Suggest Price update request */}
                    <form onSubmit={handleSuggestPrice} className="border-t border-gray-100 pt-3 flex items-end gap-2">
                      <div className="flex-1">
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                          ¿Viste otro precio en la góndola? Sugiere actualización:
                        </label>
                        <div className="relative rounded-md shadow-sm">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <span className="text-gray-500 sm:text-sm">$</span>
                          </div>
                          <input
                            type="number"
                            step="any"
                            required
                            placeholder="Proponer precio nuevo"
                            className="w-full border border-gray-300 pl-7 pr-3 py-1.5 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            value={proposedPrice}
                            onChange={(e) => setProposedPrice(e.target.value)}
                          />
                        </div>
                      </div>
                      <button
                        type="submit"
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-xs font-bold shadow flex items-center gap-1 transition"
                      >
                        Proponer
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </div>

            {/* SUGERIR NUEVO PRODUCTO QUE NO EXISTE */}
            <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100 space-y-4">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                ✍️ Sugerir Nuevo Producto al Sistema
              </h2>
              <p className="text-xs text-gray-500">
                Si escaneas un producto que no está en la base de datos, puedes sugerirlo cargando sus detalles para que el administrador lo apruebe.
              </p>

              <form onSubmit={handleSuggestProduct} className="grid grid-cols-2 gap-3 text-xs">
                <div className="col-span-2">
                  <label className="block font-semibold text-gray-700 mb-1">Nombre / Título del Producto</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Galletitas Oreo Original 117g"
                    className="w-full border border-gray-300 p-2 rounded-md text-sm text-gray-900"
                    value={newProductForm.title}
                    onChange={(e) => setNewProductForm(prev => ({ ...prev, title: e.target.value }))}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block font-semibold text-gray-700 mb-1">Descripción / Notas</label>
                  <textarea
                    rows={2}
                    placeholder="Ej. Galletitas dulces de chocolate rellenas de vainilla."
                    className="w-full border border-gray-300 p-2 rounded-md text-sm text-gray-900"
                    value={newProductForm.description}
                    onChange={(e) => setNewProductForm(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>
                <div className="col-span-1">
                  <label className="block font-semibold text-gray-700 mb-1">Código de Barras / QR</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. 7622300741217"
                    className="w-full border border-gray-300 p-2 rounded-md text-sm text-gray-900 font-mono"
                    value={newProductForm.barcode_qr}
                    onChange={(e) => setNewProductForm(prev => ({ ...prev, barcode_qr: e.target.value }))}
                  />
                </div>
                <div className="col-span-1">
                  <label className="block font-semibold text-gray-700 mb-1">URL de Imagen (opcional)</label>
                  <input
                    type="url"
                    placeholder="https://..."
                    className="w-full border border-gray-300 p-2 rounded-md text-sm text-gray-900"
                    value={newProductForm.image_url}
                    onChange={(e) => setNewProductForm(prev => ({ ...prev, image_url: e.target.value }))}
                  />
                </div>
                <div className="col-span-2 pt-2">
                  <button
                    type="submit"
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg font-bold shadow transition flex items-center justify-center gap-2 text-sm"
                  >
                    <Plus size={16} /> Sugerir Producto
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* RIGHT COLUMN: LIST BUILDER & CART OPTIMIZATION */}
          <div className="space-y-6">

            {/* ARMADOR DE LISTA DE COMPRAS (LOCAL CART) */}
            <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100 flex flex-col h-[525px] space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  📋 Tu Lista de Compras
                </h2>
                <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-1 rounded-full">
                  {cart.length} productos
                </span>
              </div>

              {/* Add item dropdown */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-gray-700">Añadir producto registrado:</label>
                <div className="flex gap-2">
                  <select
                    className="flex-1 border border-gray-300 p-2 rounded-md text-sm text-gray-900"
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) {
                        handleAddProductToCart(e.target.value);
                        e.target.value = ""; // Reset
                      }
                    }}
                  >
                    <option value="" disabled>-- Selecciona un producto para agregar --</option>
                    {allProducts.map(p => (
                      <option key={p._id} value={p._id}>{p.title} (Cod: {p.barcode_qr})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Checklist products list */}
              <div className="flex-1 overflow-y-auto border border-gray-200 rounded-lg p-2 bg-gray-50 divide-y divide-gray-200">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400 py-12 text-center">
                    <ShoppingCart size={40} className="mb-2 text-gray-300" />
                    <p className="font-semibold text-sm">¿Qué necesitas comprar hoy?</p>
                    <p className="text-xs">Agrega productos aprobados desde el selector superior para armar tu carrito.</p>
                  </div>
                ) : (
                  cart.map((item) => (
                    <div key={item._id} className="py-2.5 flex items-center justify-between gap-3 bg-white px-3 my-1 rounded-md border border-gray-100 shadow-sm">
                      <div className="min-w-0 flex items-center gap-2">
                        {item.image_url && (
                          <img
                            src={item.image_url}
                            alt={item.title}
                            className="w-10 h-10 rounded object-cover bg-gray-100 flex-shrink-0"
                          />
                        )}
                        <div className="min-w-0">
                          <h4 className="font-bold text-sm text-gray-900 truncate">{item.title}</h4>
                          <span className="text-[10px] text-gray-500 font-mono">Cód: {item.barcode_qr}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveFromCart(item._id)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded-md transition"
                        title="Eliminar de la lista"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Optimizer parameters and Trigger */}
              <div className="border-t border-gray-200 pt-4 space-y-4">
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-xs font-bold text-gray-700">
                    <span>Cantidad máxima de tiendas a visitar:</span>
                    <span className="text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">
                      {maxStores} {maxStores === 1 ? 'sucursal' : 'sucursales'}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="4"
                    className="w-full accent-emerald-600 cursor-pointer"
                    value={maxStores}
                    onChange={(e) => setMaxStores(Number(e.target.value))}
                  />
                  <div className="flex justify-between text-[10px] text-gray-400 font-bold">
                    <span>1 (Ahorro medio, 1 parada)</span>
                    <span>4 (Máximo ahorro, más paradas)</span>
                  </div>
                </div>

                <button
                  onClick={handleOptimizeCart}
                  disabled={loading || cart.length === 0}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-bold shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
                >
                  <Sparkles size={16} />
                  {loading ? 'Calculando óptimo...' : 'Optimizar dónde comprar'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM OPTIMIZATION OUTPUT SHEET */}
        {optimizationResult && (
          <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100 space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-200 pb-4 gap-4">
              <div>
                <h2 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                  ✨ Plan de Compra Optimizado
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  Calculado exactamente para minimizar tu gasto total limitando la visita a {maxStores} {maxStores === 1 ? 'tienda' : 'tiendas'}.
                </p>
              </div>
              <div className="flex gap-4">
                <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl text-center">
                  <span className="text-[10px] uppercase font-bold text-emerald-800 block">Total Estimado</span>
                  <span className="text-2xl font-black text-emerald-600">${optimizationResult.grand_total}</span>
                </div>
                <div className="bg-indigo-50 border border-indigo-200 p-3 rounded-xl text-center">
                  <span className="text-[10px] uppercase font-bold text-indigo-800 block">Cobertura</span>
                  <span className="text-2xl font-black text-indigo-600">{optimizationResult.coverage_percentage}%</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

              {/* PLAN POR TIENDA CON CHECKLISTS */}
              <div className="space-y-6">
                <h3 className="text-lg font-bold text-gray-800">🚶 Ruta de Compras y Checklists</h3>

                {optimizationResult.stores_to_visit.map((visit, index) => {
                  const store = visit.store;
                  return (
                    <div key={store._id} className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                      {/* Store Header */}
                      <div className="bg-gray-100 p-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div>
                          <span className="bg-indigo-600 text-white font-bold px-2 py-0.5 rounded text-[10px] uppercase mr-2">
                            Tienda {index + 1}
                          </span>
                          <strong className="text-gray-900 text-base">{store.brand}</strong> - {store.name}
                          <p className="text-xs text-gray-500 flex items-center gap-0.5 mt-0.5">
                            <MapPin size={12} className="text-gray-400" /> {store.address}
                          </p>
                        </div>
                        <div className="text-right flex items-center gap-2 sm:flex-col sm:gap-0 sm:items-end w-full sm:w-auto justify-between border-t sm:border-0 pt-2 sm:pt-0">
                          <span className="text-xs text-gray-500 font-bold">Subtotal</span>
                          <span className="text-base font-black text-emerald-600">${visit.subtotal}</span>
                        </div>
                      </div>

                      {/* Products to buy checklist */}
                      <div className="p-4 bg-white divide-y divide-gray-100">
                        {visit.products.map(prod => {
                          const isChecked = checkedOffProducts[`${store._id}_${prod.product_id}`];
                          return (
                            <div
                              key={prod.product_id}
                              onClick={() => handleToggleProductChecked(store._id, prod.product_id)}
                              className="py-3 flex items-center justify-between cursor-pointer group hover:bg-gray-50 -mx-4 px-4 transition"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${
                                  isChecked
                                    ? 'bg-emerald-600 border-emerald-600 text-white'
                                    : 'border-gray-300 group-hover:border-emerald-600 bg-white'
                                }`}>
                                  {isChecked && <Check size={14} strokeWidth={3} />}
                                </div>
                                <div className="min-w-0">
                                  <p className={`font-bold text-sm text-gray-900 transition ${
                                    isChecked ? 'line-through text-gray-400 opacity-50' : ''
                                  }`}>
                                    {prod.title}
                                  </p>
                                  <span className="text-[10px] text-gray-500 font-mono">Cód: {prod.barcode_qr}</span>
                                </div>
                              </div>
                              <div className="text-right">
                                <span className={`font-black text-sm text-gray-950 block ${
                                  isChecked ? 'line-through text-gray-400 opacity-50' : ''
                                }`}>
                                  ${prod.price}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Google Maps link footer */}
                      <div className="bg-gray-50 p-3 border-t border-gray-100 text-right">
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${store.location.coordinates[1]},${store.location.coordinates[0]}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg shadow transition"
                        >
                          <MapPin size={12} /> Ir al supermercado (Google Maps)
                        </a>
                      </div>
                    </div>
                  );
                })}

                {/* MISSING PRODUCTS IF ANY */}
                {optimizationResult.missing_products.length > 0 && (
                  <div className="border border-red-100 rounded-xl bg-red-50 p-4 space-y-2">
                    <h4 className="text-sm font-bold text-red-800 flex items-center gap-1.5">
                      <AlertCircle size={16} /> Productos no disponibles en estas tiendas:
                    </h4>
                    <p className="text-xs text-red-700">
                      Los siguientes productos de tu lista no se comercializan en ninguna de las sucursales óptimas seleccionadas:
                    </p>
                    <ul className="list-disc list-inside text-xs text-red-600 font-semibold space-y-1">
                      {optimizationResult.missing_products.map(p => (
                        <li key={p.product_id}>{p.title} (Cód: {p.barcode_qr})</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* ROUTE MAP WITH SELECTED STORES */}
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-gray-800">🗺️ Mapa de Sucursales de tu Ruta</h3>
                <div className="h-[380px] rounded-xl border border-gray-200 overflow-hidden shadow relative">
                  <MapContainer center={[-34.6037, -58.3816]} zoom={13} className="w-full h-full">
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    {/* Markers for recommended stores */}
                    {optimizationResult.stores_to_visit.map((visit, index) => {
                      const store = visit.store;
                      return (
                        <Marker
                          key={store._id}
                          position={[store.location.coordinates[1], store.location.coordinates[0]]}
                        >
                          <Popup>
                            <div className="text-xs">
                              <span className="bg-indigo-600 text-white font-bold px-1.5 py-0.5 rounded text-[8px] uppercase block w-max mb-1">
                                Parada {index + 1}
                              </span>
                              <strong className="text-indigo-600 font-bold">{store.brand}</strong> - {store.name}<br/>
                              <span className="text-gray-500">{store.address}</span><br/>
                              <span className="text-emerald-600 font-bold block mt-1">Comprar aquí {visit.products.length} productos (${visit.subtotal})</span>
                              <a
                                href={`https://www.google.com/maps/dir/?api=1&destination=${store.location.coordinates[1]},${store.location.coordinates[0]}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-indigo-600 font-extrabold hover:underline block mt-1"
                              >
                                🗺️ Ver ruta en Google Maps
                              </a>
                            </div>
                          </Popup>
                        </Marker>
                      );
                    })}
                  </MapContainer>
                  <div className="absolute top-2 right-2 bg-white px-2.5 py-1 text-[10px] text-gray-600 rounded shadow z-[1000] font-semibold pointer-events-none">
                    ℹ️ Haz click en los marcadores para ver los subtotales e indicaciones.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
