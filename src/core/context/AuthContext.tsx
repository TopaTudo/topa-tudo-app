import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';
import type { Profile } from '../types/database';

interface AuthContextData {
  currentProfile: Profile | null;
  profiles: Profile[];
  loadingProfiles: boolean;
  isAdmin: boolean;
  isTech: boolean;
  loginWithPin: (profileId: string, pin: string) => Promise<boolean>;
  logout: () => void;
  refreshProfiles: () => Promise<void>;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

const STORAGE_KEY = 'topatudo_active_profile_id';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [loadingProfiles, setLoadingProfiles] = useState(true);

  const refreshProfiles = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, role, active, created_at')
        .eq('active', true)
        .order('name');

      if (error) {
        console.error('Erro ao buscar perfis:', error);
        return;
      }

      if (data) {
        setProfiles(data as Profile[]);

        // Check if there is an existing saved profile in localStorage
        const savedId = localStorage.getItem(STORAGE_KEY);
        if (savedId) {
          const match = data.find((p) => p.id === savedId);
          if (match) {
            setCurrentProfile(match as Profile);
          }
        }
      }
    } catch (err) {
      console.error('Falha de conexão com perfis:', err);
    } finally {
      setLoadingProfiles(false);
    }
  }, []);

  useEffect(() => {
    refreshProfiles();
  }, [refreshProfiles]);

  const loginWithPin = async (profileId: string, pin: string): Promise<boolean> => {
    try {
      // Validação segura de PIN via RPC no PostgreSQL
      const { data, error } = await supabase.rpc('verify_user_pin', {
        p_user_id: profileId,
        p_pin: pin,
      });

      if (error) {
        console.error('Erro ao verificar PIN via RPC:', error);
        return false;
      }

      if (data === true) {
        const profile = profiles.find((p) => p.id === profileId);
        if (profile) {
          setCurrentProfile(profile);
          localStorage.setItem(STORAGE_KEY, profile.id);
          return true;
        }
      }
      return false;
    } catch (err) {
      console.error('Exceção ao autenticar com PIN:', err);
      return false;
    }
  };

  const logout = () => {
    setCurrentProfile(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  const isAdmin = currentProfile?.role === 'adm';
  const isTech = currentProfile?.role === 'tecnico' || isAdmin;

  return (
    <AuthContext.Provider
      value={{
        currentProfile,
        profiles,
        loadingProfiles,
        isAdmin,
        isTech,
        loginWithPin,
        logout,
        refreshProfiles,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
