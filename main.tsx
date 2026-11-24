import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface ErrorBoundaryState {
  error: Error | null;
}

class RootErrorBoundary extends React.Component<{children: React.ReactNode}, ErrorBoundaryState> {
  state: ErrorBoundaryState = {error: null};

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {error};
  }

  render() {
    if (this.state.error) {
      return (
        <div className="fixed inset-0 flex items-center justify-center bg-[#161210] p-6 text-[#FAF5EE]">
          <div className="w-full max-w-md rounded-2xl border border-amber-500/35 bg-[#221B18] p-6 text-center shadow-2xl">
            <h1 className="font-display text-xl font-extrabold text-amber-400">
              Cavale à Ouaga — Récupération
            </h1>
            <p className="mt-2 text-sm text-[#D6CBC0]">
              Une erreur d&apos;affichage est survenue ({this.state.error.message}).
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-amber-500 px-5 py-2 text-sm font-extrabold text-[#161210] hover:bg-amber-400"
            >
              Recharger le jeu
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <RootErrorBoundary>
    <App />
  </RootErrorBoundary>
);
