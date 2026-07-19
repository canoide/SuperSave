import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('handleSubmit called with email:', email);
    setError('');
    setLoading(true);

    const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000';

    try {
      console.log(`Sending fetch to ${API_URL}/api/auth/login...`);
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      console.log('Response status:', response.status);
      const data = await response.json();
      console.log('Response body:', data);

      if (!response.ok) {
        throw new Error(data.error || 'Algo salió mal durante el ingreso');
      }

      // Store auth state in localStorage
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      console.log('Stored token and user in localStorage. Navigating...');

      // Redirect based on role
      if (data.user.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/user');
      }
    } catch (err) {
      console.error('Error during login handleSubmit:', err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-lg">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-indigo-600">
            Ahorro Súper
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Optimizador de compras inteligente y crowdsourcing
          </p>
        </div>

        {error && (
          <div id="login-error-msg" className="bg-red-50 border-l-4 border-red-500 p-4 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm space-y-4">
            <div>
              <label htmlFor="email-address" className="block text-sm font-medium text-gray-700 mb-1">
                Correo Electrónico
              </label>
              <input
                id="email-address"
                name="email"
                type="email"
                required
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="ejemplo@super.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Contraseña
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {loading ? 'Ingresando...' : 'Iniciar Sesión'}
            </button>
          </div>
        </form>

        <div className="mt-6 text-center text-sm text-gray-600">
          ¿No tienes una cuenta?{' '}
          <Link to="/register" className="font-medium text-indigo-600 hover:text-indigo-500">
            Regístrate aquí
          </Link>
        </div>

        <div className="mt-6 border-t border-gray-200 pt-4 text-center">
          <p className="text-xs text-gray-500 font-semibold mb-2">Credenciales de prueba cargadas:</p>
          <div className="flex justify-around text-xs text-gray-600 bg-gray-50 p-2 rounded">
            <div>
              <span className="font-semibold block text-indigo-600">Administrador</span>
              <span>admin@super.com</span><br/>
              <span>admin123</span>
            </div>
            <div className="border-l border-gray-200 px-2"></div>
            <div>
              <span className="font-semibold block text-emerald-600">Usuario Final</span>
              <span>user@super.com</span><br/>
              <span>user123</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
