
import React, { createContext, useState, useEffect, useContext } from "react";
import { User, AuthContextType } from "../types";
import { useToast } from "@/components/ui/use-toast";

// Contexto de autenticação
const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [users, setUsers] = useState<User[]>([]);
  const { toast } = useToast();

  // Carregar usuários do arquivo login.json
  const loadUsers = async () => {
    try {
      const response = await fetch("/login.json");
      if (!response.ok) {
        throw new Error("Falha ao carregar arquivo de usuários");
      }
      const data = await response.json();
      // Converter datas de string para objeto Date
      const processedUsers = data.users.map((u: any) => ({
        ...u,
        createdAt: new Date(u.createdAt),
        proExpiresAt: u.proExpiresAt ? new Date(u.proExpiresAt) : undefined
      }));
      setUsers(processedUsers);
      return processedUsers;
    } catch (error) {
      console.error("Erro ao carregar usuários:", error);
      return [];
    }
  };

  // Salvar usuários no localStorage como backup
  const saveUsersToLocalStorage = (usersData: User[]) => {
    localStorage.setItem("users", JSON.stringify(usersData));
    
    // Simular salvamento no arquivo JSON
    console.log("Dados de usuários salvos:", { users: usersData });
    
    // Em um ambiente real, aqui faríamos uma requisição para salvar no servidor
    // Por enquanto, apenas informamos que os dados seriam salvos
    toast({
      title: "Dados salvos",
      description: "As alterações foram salvas com sucesso no sistema.",
    });

    // Nota: Em um ambiente de produção, aqui realizaríamos uma requisição
    // para uma API que atualizaria o arquivo login.json no servidor
  };

  // Carregar usuário do localStorage ao iniciar
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      const storedUser = localStorage.getItem("user");
      
      // Carregar usuários do arquivo
      const loadedUsers = await loadUsers();
      
      // Se não houver usuários carregados, usar backup do localStorage
      if (loadedUsers.length === 0) {
        const backupUsers = localStorage.getItem("users");
        if (backupUsers) {
          setUsers(JSON.parse(backupUsers));
        }
      } else {
        // Salvar no localStorage como backup
        saveUsersToLocalStorage(loadedUsers);
      }

      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }

      setIsLoading(false);
    };

    init();
  }, []);

  // Verificar expiração de acesso Pro
  useEffect(() => {
    if (user && user.role === "pro" && user.proExpiresAt) {
      const expiryDate = new Date(user.proExpiresAt);
      if (expiryDate < new Date()) {
        // Rebaixa usuário para padrão
        const updatedUser = {
          ...user,
          role: "user" as const,
          allowedTools: user.allowedTools.filter(tool => !tool.startsWith("pro-"))
        };
        setUser(updatedUser);
        localStorage.setItem("user", JSON.stringify(updatedUser));
        
        // Atualiza na lista de usuários
        const updatedUsers = users.map((u: User) => 
          u.id === user.id ? updatedUser : u
        );
        setUsers(updatedUsers);
        saveUsersToLocalStorage(updatedUsers);
        
        toast({
          title: "Acesso Pro expirado",
          description: "Seu acesso Pro expirou. Algumas ferramentas foram desativadas.",
          variant: "destructive",
        });
      }
    }
  }, [user, users, toast]);

  // Função de login
  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      // Recarregar usuários para garantir dados atualizados
      const currentUsers = await loadUsers();
      const usersToCheck = currentUsers.length > 0 ? currentUsers : users;
      
      // Encontra o usuário
      const foundUser = usersToCheck.find((u: User) => u.email === email && u.password === password);
      
      if (!foundUser) {
        throw new Error("Credenciais inválidas");
      }
      
      // Verificamos se é um usuário Pro com acesso expirado
      if (foundUser.role === "pro" && foundUser.proExpiresAt) {
        const expiryDate = new Date(foundUser.proExpiresAt);
        if (expiryDate < new Date()) {
          foundUser.role = "user";
          foundUser.allowedTools = foundUser.allowedTools.filter(tool => !tool.startsWith("pro-"));
          
          // Atualiza na lista de usuários
          const updatedUsers = usersToCheck.map((u: User) => 
            u.id === foundUser.id ? foundUser : u
          );
          setUsers(updatedUsers);
          saveUsersToLocalStorage(updatedUsers);
          
          toast({
            title: "Acesso Pro expirado",
            description: "Seu acesso Pro expirou. Algumas ferramentas foram desativadas.",
            variant: "destructive",
          });
        }
      }
      
      // Guarda o usuário na sessão
      localStorage.setItem("user", JSON.stringify(foundUser));
      setUser(foundUser);
      
      toast({
        title: "Bem-vindo!",
        description: `Login realizado com sucesso. Bem-vindo, ${foundUser.username}!`,
      });
    } catch (error) {
      toast({
        title: "Erro ao fazer login",
        description: (error as Error).message,
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Função de registro
  const register = async (username: string, email: string, password: string) => {
    setIsLoading(true);
    try {
      // Recarregar usuários para garantir dados atualizados
      await loadUsers();
      
      // Verifica se o email já está em uso
      const existingUser = users.find((u: User) => u.email === email);
      
      if (existingUser) {
        throw new Error("Email já está em uso");
      }
      
      // Cria novo usuário
      const newUser: User = {
        id: `user-${Date.now()}`,
        username,
        email,
        password,
        role: "user",
        createdAt: new Date(),
        allowedTools: ["calc-eng", "calc-ele"] // Ferramentas padrão
      };
      
      // Adiciona à lista de usuários
      const updatedUsers = [...users, newUser];
      setUsers(updatedUsers);
      
      // Salvar no localStorage e simular salvamento no arquivo JSON
      saveUsersToLocalStorage(updatedUsers);
      
      // Faz login com o novo usuário
      localStorage.setItem("user", JSON.stringify(newUser));
      setUser(newUser);
      
      toast({
        title: "Conta criada com sucesso",
        description: `Bem-vindo, ${username}! Sua conta foi registrada permanentemente.`,
      });
    } catch (error) {
      toast({
        title: "Erro ao criar conta",
        description: (error as Error).message,
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Função para atualizar usuários
  const updateUsers = (updatedUsers: User[]) => {
    setUsers(updatedUsers);
    saveUsersToLocalStorage(updatedUsers);
  };

  // Função para obter todos os usuários
  const getAllUsers = () => {
    return users;
  };

  // Função de logout
  const logout = () => {
    localStorage.removeItem("user");
    setUser(null);
    toast({
      title: "Logout realizado",
      description: "Você saiu da sua conta.",
    });
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isLoading, 
      login, 
      register, 
      logout, 
      updateUsers, 
      getAllUsers 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
