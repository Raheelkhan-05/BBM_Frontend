import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error("[DetailPanel crash]", error, info.componentStack);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <p className="text-sm font-bold text-rose-600 mb-2">Something broke opening this record</p>
            <pre className="text-[11px] text-slate-500 whitespace-pre-wrap max-h-60 overflow-auto">
              {String(this.state.error?.message || this.state.error)}
            </pre>
            <button
              onClick={() => { this.setState({ error: null }); this.props.onClose?.(); }}
              className="mt-3 w-full rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200"
            >
              Close
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}