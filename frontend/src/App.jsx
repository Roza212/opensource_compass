import { useState } from 'react';
import LandingView from './components/LandingView';
import DashboardView from './components/DashboardView';
import './index.css';

function App() {
  const [repoName, setRepoName] = useState(null);

  return repoName ? (
    <DashboardView repoName={repoName} />
  ) : (
    <LandingView onAnalyze={(name) => setRepoName(name)} />
  );
}

export default App;
