import { Component, type ErrorInfo, type ReactNode } from 'react';
import { t } from '../i18n';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Ошибка интерфейса:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="error-screen">
          <h2>{t('ui.error.title')}</h2>
          <pre>{this.state.error.message}</pre>
          <button className="primary" onClick={() => window.location.reload()}>
            {t('ui.error.reload')}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
