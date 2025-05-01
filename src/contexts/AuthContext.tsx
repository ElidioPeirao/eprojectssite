
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

  // Salvar usuários no arquivo login.json
  const saveUsersToFile = async (usersData: User[]) => {
    try {
      // Preparar dados para salvar (converter Dates para strings)
      const dataToSave = {
        users: usersData.map(u => ({
          ...u,
          createdAt: u.createdAt.toISOString(),
          proExpiresAt: u.proExpiresAt ? u.proExpiresAt.toISOString() : undefined
        }))
      };

      // Em um ambiente de produção, aqui faríamos uma requisição para a API
      // Como simulação, salvamos os dados atualizados no localStorage
      localStorage.setItem("users", JSON.stringify(usersData));
      
      // Simulação de gravação no arquivo
      console.log("Gravando em login.json:", dataToSave);

      // Em um ambiente real, aqui faríamos uma requisição POST/PUT
      // Exemplo simulado:
      // const response = await fetch('/api/users', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(dataToSave)
      // });
      
      toast({
        title: "Dados salvos",
        description: "Os dados de usuário foram atualizados no arquivo login.json.",
      });
      
      return true;
    } catch (error) {
      console.error("Erro ao salvar usuários no arquivo:", error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível atualizar o arquivo login.json.",
        variant: "destructive",
      });
      return false;
    }
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
        saveUsersToFile(updatedUsers);
        
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
      // Recarregar usuários do arquivo login.json para garantir dados atualizados
      const usersFromFile = await loadUsers();
      
      if (usersFromFile.length === 0) {
        throw new Error("Não foi possível carregar os usuários do arquivo login.json");
      }
      
      // Encontra o usuário
      const foundUser = usersFromFile.find((u: User) => u.email === email && u.password === password);
      
      if (!foundUser) {
        throw new Error("Credenciais inválidas. Verifique seu email e senha.");
      }
      
      // Verificamos se é um usuário Pro com acesso expirado
      if (foundUser.role === "pro" && foundUser.proExpiresAt) {
        const expiryDate = new Date(foundUser.proExpiresAt);
        if (expiryDate < new Date()) {
          foundUser.role = "user";
          foundUser.allowedTools = foundUser.allowedTools.filter(tool => !tool.startsWith("pro-"));
          
          // Atualiza na lista de usuários
          const updatedUsers = usersFromFile.map((u: User) => 
            u.id === foundUser.id ? foundUser : u
          );
          setUsers(updatedUsers);
          await saveUsersToFile(updatedUsers);
          
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
      // Recarregar usuários do arquivo login.json para garantir dados atualizados
      const usersFromFile = await loadUsers();
      const usersToCheck = usersFromFile.length > 0 ? usersFromFile : users;
      
      // Verifica se o email já está em uso
      const existingUser = usersToCheck.find((u: User) => u.email === email);
      
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
      const updatedUsers = [...usersToCheck, newUser];
      setUsers(updatedUsers);
      
      // Salvar no arquivo login.json
      await saveUsersToFile(updatedUsers);
      
      // Faz login com o novo usuário
      localStorage.setItem("user", JSON.stringify(newUser));
      setUser(newUser);
      
      toast({
        title: "Conta criada com sucesso",
        description: `Bem-vindo, ${username}! Sua conta foi registrada permanentemente no arquivo login.json.`,
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
  const updateUsers = async (updatedUsers: User[]) => {
    setUsers(updatedUsers);
    await saveUsersToFile(updatedUsers);
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
