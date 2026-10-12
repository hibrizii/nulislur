import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  private handleLogout = () => {
    sessionStorage.removeItem('nulislur_session');
    localStorage.removeItem('nulislur_session');
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FAF9F6] dark:bg-[#0c0a09] flex items-center justify-center p-6 text-stone-900 dark:text-stone-100 transition-colors duration-200">
          <div className="editorial-card max-w-lg w-full bg-white dark:bg-stone-900 p-8 border border-stone-200/90 dark:border-stone-800 shadow-xl rounded-2xl text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={28} />
            </div>

            <h2 className="text-2xl font-bold font-serif-literary mb-2">
              Terjadi Kendala Teknis
            </h2>
            <p className="text-xs text-stone-500 mb-6 leading-relaxed">
              Sistem mendeteksi galat saat memuat komponen ini. Anda dapat memuat ulang halaman atau kembali ke gerbang utama.
            </p>

            {this.state.error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-left text-xs font-mono text-red-800 mb-6 overflow-x-auto max-h-36">
                <strong>Error:</strong> {this.state.error.toString()}
              </div>
            )}

            <div className="flex gap-3 justify-center">
              <button
                type="button"
                onClick={this.handleLogout}
                className="editorial-btn bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs py-2.5 px-4"
              >
                <Home size={14} /> Ke Halaman Masuk
              </button>
              <button
                type="button"
                onClick={this.handleReset}
                className="editorial-btn bg-stone-900 hover:bg-stone-800 text-white text-xs py-2.5 px-4"
              >
                <RotateCcw size={14} /> Muat Ulang
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
