import React from 'react';

export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, info: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, info) {
        // log to console so developer sees it in terminal/devtools
        console.error('Unhandled render error:', error, info);
        this.setState({ error, info });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: 24 }}>
                    <h2>Something went wrong rendering the app</h2>
                    <pre style={{ whiteSpace: 'pre-wrap', color: 'crimson' }}>
                        {String(
                            this.state.error && this.state.error.toString(),
                        )}
                    </pre>
                    {this.state.info && (
                        <details style={{ whiteSpace: 'pre-wrap' }}>
                            {this.state.info.componentStack}
                        </details>
                    )}
                </div>
            );
        }
        return this.props.children;
    }
}
