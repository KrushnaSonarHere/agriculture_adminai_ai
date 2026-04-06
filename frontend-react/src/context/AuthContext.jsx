import { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const id = sessionStorage.getItem('user_id');
    if (!id) return null;
    return {
      id:               id,
      farmer_id:        sessionStorage.getItem('farmer_id'),
      full_name:        sessionStorage.getItem('full_name'),
      email:            sessionStorage.getItem('email'),
      mobile:           sessionStorage.getItem('mobile'),
      district:         sessionStorage.getItem('district'),
      role:             sessionStorage.getItem('role'),
      profile_complete: sessionStorage.getItem('profile_complete') === 'true',
    };
  });

  const login = (userData) => {
    sessionStorage.setItem('user_id',          userData.id);
    sessionStorage.setItem('farmer_id',         userData.farmer_id || '');
    sessionStorage.setItem('full_name',         userData.full_name);
    sessionStorage.setItem('email',             userData.email);
    sessionStorage.setItem('mobile',            userData.mobile || '');
    sessionStorage.setItem('district',          userData.district || '');
    sessionStorage.setItem('role',              userData.role);
    sessionStorage.setItem('profile_complete',  String(userData.profile_complete));
    setUser(userData);
  };

  const logout = () => {
    sessionStorage.clear();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
