import React, { useState, useEffect } from "react";
import {
  Cloud,
  FileText,
  File,
  Image,
  RefreshCw,
  Search,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Loader2,
  LogOut,
  Folder,
  ArrowDownToLine,
  FileSpreadsheet,
} from "lucide-react";
import { googleDriveService, GoogleDriveFile } from "../services/googleDriveService";

interface GoogleDriveSelectorProps {
  onSelectFile: (fileData: { name: string; contentText: string; base64?: string; isPdf?: boolean; mimeType: string }) => void;
  onCancel: () => void;
}

export const GoogleDriveSelector: React.FC<GoogleDriveSelectorProps> = ({ onSelectFile, onCancel }) => {
  const [isConnected, setIsConnected] = useState<boolean>(googleDriveService.isAuthenticated());
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [files, setFiles] = useState<GoogleDriveFile[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<GoogleDriveFile | null>(null);

  const loadFiles = async (query?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const list = await googleDriveService.listFiles(query);
      setFiles(list);
      setIsConnected(true);
    } catch (err: any) {
      setError(err.message || "Erro ao carregar arquivos do Google Drive.");
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isConnected) {
      loadFiles();
    }
  }, [isConnected]);

  const handleConnect = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await googleDriveService.getAccessToken();
      setIsConnected(true);
      await loadFiles();
    } catch (err: any) {
      setError(err.message || "Erro ao autenticar com o Google Drive.");
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = () => {
    googleDriveService.disconnect();
    setIsConnected(false);
    setFiles([]);
    setSelectedFile(null);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isConnected) {
      loadFiles(searchQuery);
    }
  };

  const handleImportSelected = async () => {
    if (!selectedFile) return;
    setIsDownloading(true);
    setError(null);
    try {
      const data = await googleDriveService.fetchFileContent(selectedFile);
      onSelectFile({
        name: selectedFile.name,
        contentText: data.text,
        base64: data.base64,
        isPdf: data.isPdf,
        mimeType: selectedFile.mimeType,
      });
    } catch (err: any) {
      setError(err.message || "Erro ao baixar arquivo selecionado.");
    } finally {
      setIsDownloading(false);
    }
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.includes("pdf")) return <FileText className="w-5 h-5 text-red-500" />;
    if (mimeType.includes("document") || mimeType.includes("text")) return <FileText className="w-5 h-5 text-blue-500" />;
    if (mimeType.includes("spreadsheet") || mimeType.includes("csv")) return <FileSpreadsheet className="w-5 h-5 text-emerald-500" />;
    if (mimeType.includes("image")) return <Image className="w-5 h-5 text-purple-500" />;
    if (mimeType.includes("folder")) return <Folder className="w-5 h-5 text-amber-500" />;
    return <File className="w-5 h-5 text-stone-500" />;
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* HEADER & STATUS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-stone-150">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center">
            <Cloud className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-stone-900">Google Drive & Documentos</h3>
            <p className="text-xs text-stone-500">
              Importe briefings, manuais de produto, planilhas e relatórios da nuvem.
            </p>
          </div>
        </div>

        {isConnected && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => loadFiles(searchQuery)}
              disabled={isLoading}
              className="p-2 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-xl border border-stone-200 text-xs transition-colors"
              title="Atualizar lista"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-blue-600" : ""}`} />
            </button>
            <button
              onClick={handleDisconnect}
              className="px-2.5 py-1.5 text-stone-600 hover:text-red-700 hover:bg-red-50 rounded-xl border border-stone-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              title="Desconectar conta"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Desconectar</span>
            </button>
          </div>
        )}
      </div>

      {/* ERROR ALERT */}
      {error && (
        <div className="p-3.5 bg-red-50 text-red-800 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Aviso Google Drive: </span>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* NOT CONNECTED STATE */}
      {!isConnected ? (
        <div className="p-8 text-center bg-stone-50 rounded-2xl border border-stone-200 space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mx-auto">
            <Cloud className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h4 className="text-sm font-black text-stone-900">Conectar com sua conta Google</h4>
            <p className="text-xs text-stone-500 leading-relaxed">
              Autorize o acesso seguro via Google Identity para listar e importar arquivos diretamente para o seu Cofre PKM.
            </p>
          </div>
          <button
            onClick={handleConnect}
            disabled={isLoading}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-2 mx-auto cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Cloud className="w-4 h-4" />
            )}
            <span>Conectar Google Drive</span>
          </button>
        </div>
      ) : (
        /* CONNECTED & LISTING FILES */
        <div className="space-y-4">
          {/* SEARCH BAR */}
          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-stone-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Pesquisar por nome ou conteúdo no Google Drive..."
                className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-stone-900 text-white text-xs font-bold rounded-xl hover:bg-stone-800 transition-colors cursor-pointer"
            >
              Pesquisar
            </button>
          </form>

          {/* FILES LIST CONTAINER */}
          <div className="border border-stone-200 rounded-2xl overflow-hidden bg-white max-h-72 overflow-y-auto divide-y divide-stone-100">
            {isLoading ? (
              <div className="p-8 text-center text-xs text-stone-500 flex flex-col items-center gap-2">
                <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                <span>Carregando arquivos do Google Drive...</span>
              </div>
            ) : files.length === 0 ? (
              <div className="p-8 text-center text-xs text-stone-500">
                Nenhum arquivo encontrado no seu Google Drive com os critérios informados.
              </div>
            ) : (
              files.map((file) => {
                const isSelected = selectedFile?.id === file.id;
                return (
                  <div
                    key={file.id}
                    onClick={() => setSelectedFile(file)}
                    className={`p-3 flex items-center justify-between gap-3 hover:bg-blue-50/50 cursor-pointer transition-colors ${
                      isSelected ? "bg-blue-50 border-l-4 border-blue-600" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 bg-stone-100 rounded-lg shrink-0">
                        {getFileIcon(file.mimeType)}
                      </div>
                      <div className="min-w-0">
                        <span className="block text-xs font-bold text-stone-900 truncate">
                          {file.name}
                        </span>
                        <div className="flex items-center gap-2 text-[10px] text-stone-400 mt-0.5">
                          {file.size && <span>{file.size}</span>}
                          {file.modifiedTime && <span>• Modificado em {file.modifiedTime}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {file.webViewLink && (
                        <a
                          href={file.webViewLink}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100 transition-colors"
                          title="Abrir no Google Drive"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                      {isSelected && (
                        <CheckCircle2 className="w-4 h-4 text-blue-600" />
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* ACTION BUTTONS */}
          <div className="pt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-stone-500 hover:text-stone-800 text-xs font-bold rounded-xl cursor-pointer"
            >
              Voltar
            </button>

            <button
              type="button"
              disabled={!selectedFile || isDownloading}
              onClick={handleImportSelected}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isDownloading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ArrowDownToLine className="w-4 h-4" />
              )}
              <span>Importar para Curadoria PKM</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
