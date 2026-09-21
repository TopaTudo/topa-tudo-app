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
const PROFILES_CACHE_KEY = 'topatudo_cached_profiles';
const CURRENT_PROFILE_CACHE_KEY = 'topatudo_cached_current_profile';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profiles, setProfiles] = useState<Profile[]>(() => {
    try {
      const cached = localStorage.getItem(PROFILES_CACHE_KEY);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const [currentProfile, setCurrentProfile] = useState<Profile | null>(() => {
    try {
      const cached = localStorage.getItem(CURRENT_PROFILE_CACHE_KEY);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  const [loadingProfiles, setLoadingProfiles] = useState(true);

  const restoreFromCache = useCallback(() => {
    try {
      const cachedProfilesStr = localStorage.getItem(PROFILES_CACHE_KEY);
      if (cachedProfilesStr) {
        const cachedProfiles = JSON.parse(cachedProfilesStr) as Profile[];
        setProfiles(cachedProfiles);

        const cachedProfileStr = localStorage.getItem(CURRENT_PROFILE_CACHE_KEY);
        const savedId = localStorage.getItem(STORAGE_KEY);
        if (cachedProfileStr) {
          setCurrentProfile(JSON.parse(cachedProfileStr));
        } else if (savedId) {
          const match = cachedProfiles.find((p) => p.id === savedId);
          if (match) {
            setCurrentProfile(match);
          }
        }
      }
    } catch (e) {
      console.warn('Falha ao restaurar perfis do cache:', e);
    }
  }, []);

  const refreshProfiles = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, role, active, created_at')
        .eq('active', true)
        .order('name');

      if (error) {
        console.error('Erro ao buscar perfis (restaurando do cache local):', error);
        restoreFromCache();
        return;
      }

      if (data) {
        setProfiles(data as Profile[]);
        try {
          localStorage.setItem(PROFILES_CACHE_KEY, JSON.stringify(data));
        } catch (e) {
          console.warn('Erro ao salvar perfis no localStorage:', e);
        }

        // Check if there is an existing saved profile in localStorage
        const savedId = localStorage.getItem(STORAGE_KEY);
        if (savedId) {
          const match = data.find((p) => p.id === savedId);
          if (match) {
            setCurrentProfile(match as Profile);
            try {
              localStorage.setItem(CURRENT_PROFILE_CACHE_KEY, JSON.stringify(match));
            } catch (e) {
              console.warn('Erro ao salvar perfil atual no localStorage:', e);
            }
          }
        }
      }
    } catch (err) {
      console.error('Falha de conexão com perfis (modo offline ativado):', err);
      restoreFromCache();
    } finally {
      setLoadingProfiles(false);
    }
  }, [restoreFromCache]);

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
          try {
            localStorage.setItem(CURRENT_PROFILE_CACHE_KEY, JSON.stringify(profile));
          } catch (e) {
            console.warn('Erro ao cachear perfil atual:', e);
          }
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
    localStorage.removeItem(CURRENT_PROFILE_CACHE_KEY);
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
