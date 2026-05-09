import { useState } from 'react';
import LandingView from './views/LandingView';
import DashboardView from './views/DashboardView';
import AboutView from './views/AboutView';
import './index.css';

function App() {
  const [currentView, setCurrentView] = useState('landing');
  const [repoName, setRepoName] = useState(null);

  if (currentView === 'about') {
    return <AboutView onBack={() => setCurrentView('landing')} />;
  }

  if (repoName) {
    return (
      <DashboardView 
        repoName={repoName} 
        onReset={() => { 
          setRepoName(null); 
          setCurrentView('landing'); 
        }} 
      />
    );
  }

  return (
    <LandingView 
      onAnalyze={(name) => {
        setRepoName(name);
        setCurrentView('dashboard');
      }} 
      onNavigateAbout={() => setCurrentView('about')}
    />
  );
}

export default App;
