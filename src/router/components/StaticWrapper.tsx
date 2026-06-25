import { useLocation, useNavigate } from "react-router";
import { useState, useEffect } from "react";
import QuickPractice from "@/views/QuickPractice";
import History from "@/views/History";
import QuestionBank from "@/views/QuestionBank";
import ResumeRoast from "@/views/ResumeRoast";
import InterviewPrep from "@/views/InterviewPrep";
import QuickPrep from "@/views/QuickPrep";
import { OFFLINE_MODE } from "@/services/aiService";
import '../../styles/Layout.css';

const RouterView = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isBooting, setIsBooting] = useState(true);
  const [bootProgress, setBootProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString('zh-CN'));

  useEffect(() => {
    const totalPixels = 20;
    const intervalTime = 3000 / totalPixels;
    let currentPixel = 0;

    const bootInterval = setInterval(() => {
      currentPixel++;
      setBootProgress(currentPixel);

      if (currentPixel >= totalPixels) {
        clearInterval(bootInterval);
        setTimeout(() => setIsBooting(false), 200);
      }
    }, intervalTime);

    const hasBooted = sessionStorage.getItem('hasBooted');
    if (hasBooted) {
      setIsBooting(false);
      clearInterval(bootInterval);
    } else {
      sessionStorage.setItem('hasBooted', 'true');
    }

    return () => clearInterval(bootInterval);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('zh-CN'));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const getActiveTab = () => {
    if (location.pathname === '/roast' || location.pathname === '/resume-roast') return 'roast';
    if (location.pathname === '/questionbank') return 'questionbank';
    if (location.pathname === '/history') return 'history';
    if (location.pathname === '/prep') return 'prep';
    // Legacy routes redirect to new tabs
    if (location.pathname === '/quick' || location.pathname === '/targeted' || location.pathname === '/diagnosis') {
      return 'prep'; // 重定向到面试准备
    }
    return 'prep';
  };

  const tabs = [
    { key: 'prep', label: '面试准备', path: '/prep', hint: '调研+预测+闭环' },
    { key: 'roast', label: '面试拷打', path: '/roast', hint: '轻量刷题/Agent模拟' },
    { key: 'questionbank', label: '题库', path: '/questionbank', hint: '分类练习+错题' },
    { key: 'history', label: '历史', path: '/history', hint: '记录+诊断报告' },
  ];

  const getContent = () => {
    switch (location.pathname) {
      case '/roast':
      case '/resume-roast':
        return <ResumeRoast />;
      case '/questionbank':
        return <QuestionBank />;
      case '/history':
        return <History />;
      case '/prep':
      default:
        return <InterviewPrep />;
    }
  };

  return (
    <div className="crt-container">
      <div className="crt">
        <div className="crt-top-bar">
          <div className="crt-top-left">
            <span className="crt-icon">▮▮</span>
            <span className="crt-system">AI-TERMINAL</span>
          </div>
          <div className="crt-top-center">
            <span className="crt-time">{currentTime}</span>
          </div>
          <div className="crt-top-right">
            <span className={`crt-status ${OFFLINE_MODE ? 'offline' : 'online'}`}>{OFFLINE_MODE ? 'DEMO' : 'ONLINE'}</span>
          </div>
        </div>

        <div className="crt-frame">
          {isBooting && (
            <div className="boot-screen">
              <div className="boot-animation">
                {Array.from({ length: 20 }, (_, i) => (
                  <div
                    key={i}
                    className={`boot-pixel ${i < bootProgress ? 'active' : ''}`}
                  />
                ))}
              </div>
              <div className="boot-text">System Initializing...</div>
            </div>
          )}

          <div className="crt-screen">
            <div className="crt-scanlines" />

            <div className="layout">
              <main className="main-content">
              <div className="status-bar">&gt; SYSTEM READY</div>
              <nav className="nav-tabs">
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    className={`nav-tab ${getActiveTab() === tab.key ? 'active' : ''}`}
                    onClick={() => navigate(tab.path)}
                    title={tab.hint}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
              <div className="page-container">
                {getContent()}
              </div>
            </main>
            </div>
          </div>
        </div>

        <div className="crt-controls">
          <div className="crt-indicator" />
          <div className="crt-buttons">
            <button className="crt-button power" title="Power" />
            <button className="crt-button" title="Menu" />
            <button className="crt-button" title="Brightness" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default RouterView;
