import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Plus, Trash2, Check, X, MapPin } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

// Fix Leaflet marker icons with reliable CDN resources
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Component to handle map clicks and capture coordinates
function MapClickEvents({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [token, setToken] = useState('');
  const [currentUser, setCurrentUser] = useState(null);

  // Active navigation tab for Moderation Dashboard
  const [activeTab, setActiveTab] = useState('products'); // 'products' or 'prices'

  // Moderation state lists
  const [pendingProducts, setPendingProducts] = useState([]);
  const [pendingPrices, setPendingPrices] = useState([]);

  // ABM Stores State
  const [stores, setStores] = useState([]);
  const [storeForm, setStoreForm] = useState({
    name: '',
    brand: '',
    address: '',
    latitude: -34.6037, // default Buenos Aires
    longitude: -58.3816,
  });

  const [message, setMessage] = useState({ text: '', type: '' });

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (!storedToken || !storedUser) {
      navigate('/login');
      return;
    }

    const userObj = JSON.parse(storedUser);
    if (userObj.role !== 'admin') {
      navigate('/user');
      return;
    }

    setToken(storedToken);
    setCurrentUser(userObj);
  }, [navigate]);

  useEffect(() => {
    if (token) {
      fetchPendingProducts();
      fetchPendingPrices();
      fetchStores();
    }
  }, [token]);

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 5000);
  };

  // FETCH HELPER FUNCTIONS
  const fetchPendingProducts = async () => {
    try {
      const res = await fetch('http://127.0.0.1:5000/api/admin/pending-products', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPendingProducts(data);
      }
    } catch (err) {
      console.error('Error fetching pending products:', err);
    }
  };

  const fetchPendingPrices = async () => {
    try {
      const res = await fetch('http://127.0.0.1:5000/api/admin/pending-prices', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPendingPrices(data);
      }
    } catch (err) {
      console.error('Error fetching pending prices:', err);
    }
  };

  const fetchStores = async () => {
    try {
      const res = await fetch('http://127.0.0.1:5000/api/admin/stores', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStores(data);
      }
    } catch (err) {
      console.error('Error fetching stores:', err);
    }
  };

  // ACTION HANDLERS
  const handleApproveProduct = async (id) => {
    try {
      const res = await fetch(`http://127.0.0.1:5000/api/admin/products/${id}/approve`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        showMessage('Producto aprobado correctamente.');
        fetchPendingProducts();
      } else {
        showMessage(data.error || 'Error al aprobar', 'error');
      }
    } catch (err) {
      showMessage('Error de conexión', 'error');
    }
  };

  const handleRejectProduct = async (id) => {
    try {
      const res = await fetch(`http://127.0.0.1:5000/api/admin/products/${id}/reject`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        showMessage('Sugerencia de producto rechazada y eliminada.');
        fetchPendingProducts();
      } else {
        showMessage(data.error || 'Error al rechazar', 'error');
      }
    } catch (err) {
      showMessage('Error de conexión', 'error');
    }
  };

  const handleApprovePrice = async (id) => {
    try {
      const res = await fetch(`http://127.0.0.1:5000/api/admin/prices/${id}/approve`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        showMessage('Actualización de precio aprobada con éxito.');
        fetchPendingPrices();
      } else {
        showMessage(data.error || 'Error al aprobar precio', 'error');
      }
    } catch (err) {
      showMessage('Error de conexión', 'error');
    }
  };

  const handleRejectPrice = async (id) => {
    try {
      const res = await fetch(`http://127.0.0.1:5000/api/admin/prices/${id}/reject`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        showMessage('Sugerencia de precio rechazada.');
        fetchPendingPrices();
      } else {
        showMessage(data.error || 'Error al rechazar precio', 'error');
      }
    } catch (err) {
      showMessage('Error de conexión', 'error');
    }
  };

  const handleCreateStore = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('http://127.0.0.1:5000/api/admin/stores', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(storeForm),
      });
      const data = await res.json();
      if (res.ok) {
        showMessage('Sucursal creada exitosamente.');
        setStoreForm({
          name: '',
          brand: '',
          address: '',
          latitude: -34.6037,
          longitude: -58.3816,
        });
        fetchStores();
      } else {
        showMessage(data.error || 'Error al crear la tienda', 'error');
      }
    } catch (err) {
      showMessage('Error al conectar con el servidor', 'error');
    }
  };

  const handleDeleteStore = async (id) => {
    if (!window.confirm('¿Seguro que deseas eliminar esta sucursal? Se borrarán todos sus precios.')) {
      return;
    }
    try {
      const res = await fetch(`http://127.0.0.1:5000/api/admin/stores/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        showMessage('Sucursal eliminada de forma permanente.');
        fetchStores();
      } else {
        showMessage(data.error || 'Error al eliminar sucursal', 'error');
      }
    } catch (err) {
      showMessage('Error al conectar con el servidor', 'error');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const handleMapClick = (lat, lng) => {
    setStoreForm(prev => ({
      ...prev,
      latitude: Number(lat.toFixed(6)),
      longitude: Number(lng.toFixed(6)),
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Admin Navbar */}
      <nav className="bg-indigo-700 text-white shadow-md px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Panel de Control de Administrador</h1>
          <p className="text-xs text-indigo-200">Conectado como: {currentUser?.email}</p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 bg-indigo-800 hover:bg-indigo-900 transition text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          <LogOut size={16} />
          Cerrar Sesión
        </button>
      </nav>

      {/* Main Content Area */}
      <div className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-8">

        {/* Global Feedback Message */}
        {message.text && (
          <div className={`p-4 rounded-lg shadow border ${
            message.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          } transition-all duration-300`}>
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* COLUMN 1: MODERATION FEED (TABBED) */}
          <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100 flex flex-col h-[650px]">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              🛡️ Moderación de la Comunidad
            </h2>

            {/* Tab controls */}
            <div className="flex border-b border-gray-200 mb-4">
              <button
                className={`flex-1 py-2 text-center font-medium text-sm border-b-2 transition ${
                  activeTab === 'products'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setActiveTab('products')}
              >
                Nuevos Productos ({pendingProducts.length})
              </button>
              <button
                className={`flex-1 py-2 text-center font-medium text-sm border-b-2 transition ${
                  activeTab === 'prices'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setActiveTab('prices')}
              >
                Actualización de Precios ({pendingPrices.length})
              </button>
            </div>

            {/* Tab Contents */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">

              {/* TAB 1: PENDING PRODUCTS */}
              {activeTab === 'products' && (
                <>
                  {pendingProducts.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 py-12">
                      <Check size={48} className="text-emerald-500 mb-2" />
                      <p className="font-medium">No hay productos pendientes</p>
                      <p className="text-xs">¡Buen trabajo! Todo está al día.</p>
                    </div>
                  ) : (
                    pendingProducts.map((p) => (
                      <div key={p._id} className="border border-gray-100 rounded-lg p-4 bg-gray-50 flex items-start gap-4">
                        {p.image_url && (
                          <img
                            src={p.image_url}
                            alt={p.title}
                            className="w-16 h-16 rounded object-cover border border-gray-200 bg-white"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-gray-900 truncate">{p.title}</h4>
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{p.description}</p>
                          <div className="mt-2 flex gap-2">
                            <span className="inline-block bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2 py-0.5 rounded">
                              QR/Barras: {p.barcode_qr}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <button
                            onClick={() => handleApproveProduct(p._id)}
                            className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md shadow"
                            title="Aprobar Producto"
                          >
                            <Check size={16} />
                          </button>
                          <button
                            onClick={() => handleRejectProduct(p._id)}
                            className="p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-md shadow"
                            title="Rechazar Producto"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </>
              )}

              {/* TAB 2: PENDING PRICE SUGGESTIONS */}
              {activeTab === 'prices' && (
                <>
                  {pendingPrices.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 py-12">
                      <Check size={48} className="text-emerald-500 mb-2" />
                      <p className="font-medium">No hay sugerencias de precios pendientes</p>
                      <p className="text-xs">¡Buen trabajo! Todo está al día.</p>
                    </div>
                  ) : (
                    pendingPrices.map((req) => (
                      <div key={req._id} className="border border-gray-100 rounded-lg p-4 bg-gray-50 flex flex-col gap-3">
                        <div className="flex justify-between items-start gap-4">
                          <div className="min-w-0">
                            <span className="text-[10px] uppercase font-bold text-indigo-600">Actualización Propuesta</span>
                            <h4 className="font-bold text-gray-950 truncate">
                              {req.product_id ? req.product_id.title : 'Producto Eliminado'}
                            </h4>
                            <p className="text-xs text-gray-600">
                              En: <span className="font-semibold">{req.store_id ? `${req.store_id.brand} (${req.store_id.name})` : 'Tienda Eliminada'}</span>
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              Dirección: {req.store_id?.address}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="text-lg font-black text-emerald-600 block">${req.proposed_price}</span>
                            <span className="text-[9px] text-gray-400 block truncate max-w-[120px]">Por: {req.submitted_by?.email}</span>
                          </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
                          <button
                            onClick={() => handleRejectPrice(req._id)}
                            className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded-md text-xs font-semibold flex items-center gap-1"
                          >
                            <X size={12} /> Rechazar
                          </button>
                          <button
                            onClick={() => handleApprovePrice(req._id)}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold flex items-center gap-1 shadow"
                          >
                            <Check size={12} /> Aprobar
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </>
              )}
            </div>
          </div>

          {/* COLUMN 2: ABM DE SUCURSALES (FORM & MAP) */}
          <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100 flex flex-col h-[650px] space-y-4">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              🏢 ABM de Sucursales de Supermercado
            </h2>

            {/* Create Store Form */}
            <form onSubmit={handleCreateStore} className="grid grid-cols-2 gap-3 text-xs">
              <div className="col-span-1">
                <label className="block font-medium text-gray-700 mb-0.5">Nombre de la Sucursal</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Sucursal Caballito"
                  className="w-full border border-gray-300 p-1.5 rounded-md text-sm text-gray-900"
                  value={storeForm.name}
                  onChange={(e) => setStoreForm(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="col-span-1">
                <label className="block font-medium text-gray-700 mb-0.5">Marca / Cadena</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Coto, Carrefour, Dia"
                  className="w-full border border-gray-300 p-1.5 rounded-md text-sm text-gray-900"
                  value={storeForm.brand}
                  onChange={(e) => setStoreForm(prev => ({ ...prev, brand: e.target.value }))}
                />
              </div>
              <div className="col-span-2">
                <label className="block font-medium text-gray-700 mb-0.5">Dirección Física</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Av. Rivadavia 5100, CABA"
                  className="w-full border border-gray-300 p-1.5 rounded-md text-sm text-gray-900"
                  value={storeForm.address}
                  onChange={(e) => setStoreForm(prev => ({ ...prev, address: e.target.value }))}
                />
              </div>
              <div className="col-span-1">
                <label className="block font-medium text-gray-700 mb-0.5">Latitud (hacer click en mapa)</label>
                <input
                  type="number"
                  step="any"
                  required
                  className="w-full border border-gray-200 bg-gray-50 p-1.5 rounded-md text-sm text-gray-600 font-mono"
                  value={storeForm.latitude}
                  readOnly
                />
              </div>
              <div className="col-span-1">
                <label className="block font-medium text-gray-700 mb-0.5">Longitud (hacer click en mapa)</label>
                <input
                  type="number"
                  step="any"
                  required
                  className="w-full border border-gray-200 bg-gray-50 p-1.5 rounded-md text-sm text-gray-600 font-mono"
                  value={storeForm.longitude}
                  readOnly
                />
              </div>
              <div className="col-span-2">
                <button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-md font-bold shadow flex items-center justify-center gap-2 text-sm"
                >
                  <Plus size={16} /> Dar de Alta Sucursal
                </button>
              </div>
            </form>

            {/* Interactive Leaflet Map to Click & Locate coordinates */}
            <div className="flex-1 min-h-[220px] rounded-lg border border-gray-200 overflow-hidden relative">
              <MapContainer center={[-34.6037, -58.3816]} zoom={13} className="w-full h-full">
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {/* Captured position marker */}
                <Marker position={[storeForm.latitude, storeForm.longitude]}>
                  <Popup>📍 Ubicación seleccionada para la nueva sucursal</Popup>
                </Marker>

                {/* Existing stores markers */}
                {stores.map((s) => (
                  <Marker
                    key={s._id}
                    position={[s.location.coordinates[1], s.location.coordinates[0]]}
                  >
                    <Popup>
                      <div className="text-xs">
                        <strong className="text-indigo-600 font-bold">{s.brand}</strong> - {s.name}<br/>
                        {s.address}
                      </div>
                    </Popup>
                  </Marker>
                ))}

                <MapClickEvents onMapClick={handleMapClick} />
              </MapContainer>
              <div className="absolute top-2 right-2 bg-white px-2 py-1 text-[10px] text-gray-600 rounded shadow z-[1000] font-semibold pointer-events-none">
                💡 Haz click en el mapa para capturar las coordenadas
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM FULL-WIDTH: STORE LISTING & MANAGEMENT */}
        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            📍 Listado y Eliminación de Sucursales
          </h2>

          {stores.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-6">No hay sucursales cargadas en el sistema.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-bold text-gray-600">Cadena</th>
                    <th className="px-4 py-3 text-left font-bold text-gray-600">Nombre Sucursal</th>
                    <th className="px-4 py-3 text-left font-bold text-gray-600">Dirección</th>
                    <th className="px-4 py-3 text-center font-bold text-gray-600">Coordenadas</th>
                    <th className="px-4 py-3 text-center font-bold text-gray-600">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {stores.map((store) => (
                    <tr key={store._id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3 font-bold text-indigo-700">{store.brand}</td>
                      <td className="px-4 py-3 text-gray-800">{store.name}</td>
                      <td className="px-4 py-3 text-gray-600">{store.address}</td>
                      <td className="px-4 py-3 text-center text-xs font-mono text-gray-500">
                        {store.location.coordinates[1].toFixed(5)}, {store.location.coordinates[0].toFixed(5)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleDeleteStore(store._id)}
                          className="p-1.5 text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 rounded-md transition"
                          title="Eliminar Sucursal"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
