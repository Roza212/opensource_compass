import { useState } from 'react';
import LandingView from './views/LandingView';
import DashboardView from './views/DashboardView';
import './index.css';

function App() {
  const [repoName, setRepoName] = useState(null);

  return repoName ? (
    <DashboardView repoName={repoName} onReset={() => setRepoName(null)} />
  ) : (
    <LandingView onAnalyze={(name) => setRepoName(name)} />
  );
}

export default App;
