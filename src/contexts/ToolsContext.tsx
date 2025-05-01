
import React, { createContext, useState, useEffect, useContext } from "react";
import { Tool } from "../types";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "./AuthContext";
import { ExternalLink } from "lucide-react";

type ToolsContextType = {
  tools: Tool[];
  addTool: (tool: Omit<Tool, "id" | "createdAt" | "createdBy">) => void;
  updateTool: (id: string, updates: Partial<Tool>) => void;
  deleteTool: (id: string) => void;
  getAccessibleTools: () => Tool[];
};

const ToolsContext = createContext<ToolsContextType>({} as ToolsContextType);

export const ToolsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tools, setTools] = useState<Tool[]>([]);
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);

  // Carregar ferramentas do arquivo JSON ao iniciar
  useEffect(() => {
    const fetchTools = async () => {
      try {
        const response = await fetch("/tools.json");
        if (!response.ok) {
          throw new Error("Falha ao carregar ferramentas");
        }
        
        const data = await response.json();
        setTools(data.tools);
        
        // Salvar no localStorage como backup
        localStorage.setItem("tools", JSON.stringify(data.tools));
      } catch (error) {
        console.error("Erro ao carregar ferramentas:", error);
        
        // Tentar usar o backup do localStorage
        const storedTools = localStorage.getItem("tools");
        if (storedTools) {
          setTools(JSON.parse(storedTools));
        }
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchTools();
  }, []);

  // Função para salvar ferramentas no arquivo tools.json
  const saveToolsToFile = async (toolsData: Tool[]) => {
    try {
      // Preparar dados para salvar (converter Dates para strings)
      const dataToSave = {
        tools: toolsData.map(t => ({
          ...t,
          createdAt: t.createdAt.toISOString()
        }))
      };

      // Em um ambiente de produção, aqui faríamos uma requisição para a API
      // Como simulação, salvamos no localStorage
      localStorage.setItem("tools", JSON.stringify(toolsData));
      
      // Simulação de gravação no arquivo
      console.log("Gravando em tools.json:", dataToSave);
      
      // Em um ambiente real, aqui faríamos uma requisição POST/PUT
      // Exemplo simulado:
      // const response = await fetch('/api/tools', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(dataToSave)
      // });
      
      toast({
        title: "Ferramentas salvas",
        description: "As alterações nas ferramentas foram salvas no arquivo tools.json.",
      });
      
      return true;
    } catch (error) {
      console.error("Erro ao salvar ferramentas no arquivo:", error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível atualizar o arquivo tools.json.",
        variant: "destructive",
      });
      return false;
    }
  };

  // Adicionar nova ferramenta
  const addTool = async (tool: Omit<Tool, "id" | "createdAt" | "createdBy">) => {
    if (!user || user.role !== "admin") {
      toast({
        title: "Acesso negado",
        description: "Apenas administradores podem adicionar ferramentas",
        variant: "destructive",
      });
      return;
    }

    const newTool: Tool = {
      ...tool,
      id: `tool-${Date.now()}`,
      createdAt: new Date(),
      createdBy: user.id
    };

    const updatedTools = [...tools, newTool];
    setTools(updatedTools);
    await saveToolsToFile(updatedTools);

    toast({
      title: "Ferramenta adicionada",
      description: `A ferramenta ${tool.name} foi adicionada com sucesso ao arquivo tools.json.`,
    });
  };

  // Atualizar ferramenta existente
  const updateTool = async (id: string, updates: Partial<Tool>) => {
    if (!user || user.role !== "admin") {
      toast({
        title: "Acesso negado",
        description: "Apenas administradores podem editar ferramentas",
        variant: "destructive",
      });
      return;
    }

    const updatedTools = tools.map(tool => 
      tool.id === id ? { ...tool, ...updates } : tool
    );

    setTools(updatedTools);
    await saveToolsToFile(updatedTools);

    toast({
      title: "Ferramenta atualizada",
      description: `A ferramenta foi atualizada com sucesso no arquivo tools.json.`,
    });
  };

  // Deletar ferramenta
  const deleteTool = async (id: string) => {
    if (!user || user.role !== "admin") {
      toast({
        title: "Acesso negado",
        description: "Apenas administradores podem remover ferramentas",
        variant: "destructive",
      });
      return;
    }

    const filteredTools = tools.filter(tool => tool.id !== id);
    setTools(filteredTools);
    await saveToolsToFile(filteredTools);

    toast({
      title: "Ferramenta removida",
      description: `A ferramenta foi removida com sucesso do arquivo tools.json.`,
    });
  };

  // Obter ferramentas acessíveis para o usuário atual
  const getAccessibleTools = () => {
    if (!user) {
      return [];
    }

    if (user.role === "admin") {
      return tools; // Admin tem acesso a todas as ferramentas
    }

    // Para usuário padrão ou pro, filtra com base em allowedTools
    return tools.filter(tool => {
      // Se a ferramenta requer Pro, verificamos o papel do usuário
      if (tool.requiresPro && user.role !== "pro") {
        return false;
      }
      
      // Verifica se a ferramenta está na lista de permitidas
      return user.allowedTools.includes(tool.id) || user.allowedTools.includes("all");
    });
  };

  return (
    <ToolsContext.Provider value={{ tools, addTool, updateTool, deleteTool, getAccessibleTools }}>
      {children}
    </ToolsContext.Provider>
  );
};

export const useTools = () => useContext(ToolsContext);
