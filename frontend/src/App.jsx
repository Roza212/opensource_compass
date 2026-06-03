import { useState } from 'react';
import LandingView from './views/LandingView';
import DashboardView from './views/DashboardView';
import AboutView from './views/AboutView';
import ThemeToggle from './components/ThemeToggle';
import './index.css';

function App() {
  const [currentView, setCurrentView] = useState('landing');
  const [repoName, setRepoName] = useState(null);

  let viewComponent;
  if (currentView === 'about') {
    viewComponent = <AboutView onBack={() => setCurrentView('landing')} />;
  } else if (repoName) {
    viewComponent = (
      <DashboardView 
        repoName={repoName} 
        onReset={() => { 
          setRepoName(null); 
          setCurrentView('landing'); 
        }} 
      />
    );
  } else {
    viewComponent = (
      <LandingView 
        onAnalyze={(name) => {
          setRepoName(name);
          setCurrentView('dashboard');
        }} 
        onNavigateAbout={() => setCurrentView('about')}
      />
    );
  }

  return (
    <>
      {viewComponent}
      <div style={{ position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 1000 }}>
        <ThemeToggle />
      </div>
    </>
  );
}

export default App;
