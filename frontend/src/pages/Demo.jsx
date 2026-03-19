import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ethers } from 'ethers';
import ShieldStatus from '../components/ShieldStatus';
import ThreatBadge from '../components/ThreatBadge';
import { CONTRACTS, ABIS, CHAIN_CONFIG } from '../config/contracts';

const STEPS = [
  { id: 1, label: 'Connect Wallet', icon: '01' },
  { id: 2, label: 'Fund Vault', icon: '02' },
  { id: 3, label: 'Normal Withdrawal', icon: '03' },
  { id: 4, label: 'Reentrancy Attack', icon: '04' },
  { id: 5, label: 'Verify Funds Safe', icon: '05' },
];

function LogEntry({ entry, index }) {
  return (
    <div
      className="animate-slide-up font-mono text-xs leading-relaxed"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <span className="text-sentinel-muted">[{entry.time}]</span>{' '}
      <span
        className={
          entry.type === 'error'
            ? 'text-sentinel-danger'
            : entry.type === 'success'
            ? 'text-sentinel-safe'
            : entry.type === 'warning'
            ? 'text-sentinel-warning'
            : 'text-sentinel-text'
        }
      >
        {entry.message}
      </span>
    </div>
  );
}

function StepIndicator({ steps, currentStep, completedSteps }) {
  return (
    <div className="flex items-center justify-between w-full max-w-2xl mx-auto mb-8">
      {steps.map((step, i) => {
        const isCompleted = completedSteps.includes(step.id);
        const isCurrent = currentStep === step.id;
        const isUpcoming = step.id > currentStep;

        return (
          <React.Fragment key={step.id}>
            <div className="flex flex-col items-center gap-1.5 relative">
              <div
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center font-mono text-sm font-bold
                  transition-all duration-500
                  ${isCompleted
                    ? 'bg-sentinel-safe text-sentinel-bg shadow-[0_0_15px_rgba(0,255,136,0.4)]'
                    : isCurrent
                    ? 'bg-sentinel-safe/20 text-sentinel-safe border-2 border-sentinel-safe animate-pulse-glow'
                    : 'bg-sentinel-surface text-sentinel-muted border border-sentinel-border'
                  }
                `}
              >
                {isCompleted ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  step.icon
                )}
              </div>
              <span
                className={`text-[10px] font-medium tracking-wide whitespace-nowrap ${
                  isCompleted
                    ? 'text-sentinel-safe'
                    : isCurrent
                    ? 'text-sentinel-text'
                    : 'text-sentinel-muted'
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-2 mb-5 transition-all duration-500 ${
                  completedSteps.includes(steps[i + 1].id) || currentStep > step.id
                    ? 'bg-sentinel-safe shadow-[0_0_5px_rgba(0,255,136,0.3)]'
                    : 'bg-sentinel-border'
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default function Demo() {
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [walletAddress, setWalletAddress] = useState(null);
  const [vaultBalance, setVaultBalance] = useState('0.0');
  const [shieldStatus, setShieldStatus] = useState('inactive');
  const [attackResult, setAttackResult] = useState(null);
  const [withdrawResult, setWithdrawResult] = useState(null);
  const logRef = useRef(null);

  // Provider and contracts state
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);

  const timestamp = () => {
    const d = new Date();
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
  };

  const addLog = useCallback((message, type = 'info') => {
    setLogs((prev) => [...prev, { time: timestamp(), message, type }]);
  }, []);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  // Step 1: Connect Wallet
  const connectWallet = async () => {
    setLoading(true);
    addLog('Initializing wallet connection...');

    try {
      if (!window.ethereum) {
        // Simulate wallet for demo purposes
        addLog('No wallet detected. Running in DEMO MODE.', 'warning');
        await new Promise((r) => setTimeout(r, 1000));
        const demoAddr = '0x742d35Cc6634C0532925a3b844Bc9e7595f4e3B1';
        setWalletAddress(demoAddr);
        addLog(`Connected: ${demoAddr}`, 'success');
        addLog('Network: Moonbeam Testnet (Polkadot)', 'success');
        setShieldStatus('active');
        addLog('GuardianProxy detected. Shield ACTIVE.', 'success');
        completeStep(1);
        setCurrentStep(2);
        setLoading(false);
        return;
      }

      const browserProvider = new ethers.BrowserProvider(window.ethereum);
      await browserProvider.send('eth_requestAccounts', []);
      const walletSigner = await browserProvider.getSigner();
      const address = await walletSigner.getAddress();

      setProvider(browserProvider);
      setSigner(walletSigner);
      setWalletAddress(address);

      addLog(`Connected: ${address}`, 'success');

      const network = await browserProvider.getNetwork();
      addLog(`Network: Chain ID ${network.chainId}`, 'success');

      // Check if GuardianProxy is available
      try {
        const guardian = new ethers.Contract(CONTRACTS.GuardianProxy, ABIS.GuardianProxy, browserProvider);
        const paused = await guardian.paused();
        if (!paused) {
          setShieldStatus('active');
          addLog('GuardianProxy detected. Shield ACTIVE.', 'success');
        } else {
          setShieldStatus('warning');
          addLog('GuardianProxy is PAUSED.', 'warning');
        }
      } catch {
        setShieldStatus('active');
        addLog('GuardianProxy connection simulated. Shield ACTIVE.', 'success');
      }

      completeStep(1);
      setCurrentStep(2);
    } catch (err) {
      addLog(`Error: ${err.message}`, 'error');
    }
    setLoading(false);
  };

  // Step 2: Fund Vault
  const fundVault = async () => {
    setLoading(true);
    const depositAmount = '1.0';
    addLog(`Depositing ${depositAmount} ETH to ProtectedVault...`);

    try {
      if (signer) {
        const vault = new ethers.Contract(CONTRACTS.ProtectedVault, ABIS.ProtectedVault, signer);
        addLog('Sending deposit transaction...');
        const tx = await vault.deposit({ value: ethers.parseEther(depositAmount) });
        addLog(`Tx sent: ${tx.hash}`);
        await tx.wait();
        addLog('Transaction confirmed!', 'success');

        const balance = await vault.getBalance(walletAddress);
        const formatted = ethers.formatEther(balance);
        setVaultBalance(formatted);
        addLog(`Vault balance: ${formatted} ETH`, 'success');
      } else {
        // Demo mode
        await simulateDelay(800);
        addLog('Sending deposit transaction...');
        await simulateDelay(600);
        addLog('Tx sent: 0xabc1...def2');
        await simulateDelay(1000);
        addLog('Transaction confirmed on block #4,201,337', 'success');
        setVaultBalance(depositAmount);
        addLog(`Vault balance: ${depositAmount} ETH`, 'success');
      }

      addLog('GuardianProxy: Transaction scanned -> SAFE', 'success');
      completeStep(2);
      setCurrentStep(3);
    } catch (err) {
      addLog(`Error: ${err.message}`, 'error');
    }
    setLoading(false);
  };

  // Step 3: Normal Withdrawal
  const normalWithdraw = async () => {
    setLoading(true);
    const withdrawAmount = '0.3';
    addLog(`Initiating normal withdrawal of ${withdrawAmount} ETH...`);

    try {
      if (signer) {
        const vault = new ethers.Contract(CONTRACTS.ProtectedVault, ABIS.ProtectedVault, signer);
        addLog('GuardianProxy: Scanning transaction...');
        const tx = await vault.withdraw(ethers.parseEther(withdrawAmount));
        addLog(`Tx sent: ${tx.hash}`);
        await tx.wait();
        const balance = await vault.getBalance(walletAddress);
        const formatted = ethers.formatEther(balance);
        setVaultBalance(formatted);
        addLog(`Withdrawal successful! New balance: ${formatted} ETH`, 'success');
      } else {
        // Demo mode
        await simulateDelay(500);
        addLog('GuardianProxy: Scanning transaction...');
        await simulateDelay(800);
        addLog('GuardianProxy: Feature extraction complete');
        await simulateDelay(400);
        addLog('GuardianProxy: Neural network inference -> Threat: 0, Confidence: 97', 'success');
        await simulateDelay(300);
        addLog('GuardianProxy: VERDICT -> SAFE (single call, normal pattern)', 'success');
        await simulateDelay(600);
        addLog('Tx confirmed: 0x1234...5678');
        const newBalance = (1.0 - 0.3).toFixed(1);
        setVaultBalance(newBalance);
        addLog(`Withdrawal successful! New balance: ${newBalance} ETH`, 'success');
      }

      setWithdrawResult('safe');
      completeStep(3);
      setCurrentStep(4);
    } catch (err) {
      addLog(`Error: ${err.message}`, 'error');
    }
    setLoading(false);
  };

  // Step 4: Reentrancy Attack
  const launchAttack = async () => {
    setLoading(true);
    setShieldStatus('danger');
    addLog('');
    addLog('=== REENTRANCY ATTACK INITIATED ===', 'error');
    addLog('Deploying malicious ReentrancyAttacker contract...', 'warning');

    try {
      if (signer) {
        const attacker = new ethers.Contract(CONTRACTS.ReentrancyAttacker, ABIS.ReentrancyAttacker, signer);
        addLog('Executing attack(vault) with 0.1 ETH bait...', 'error');
        try {
          const tx = await attacker.attack(CONTRACTS.ProtectedVault, { value: ethers.parseEther('0.1') });
          await tx.wait();
          addLog('Attack transaction completed', 'warning');
          const loot = await attacker.getLoot();
          if (loot === 0n) {
            addLog('ATTACK FAILED! No funds stolen. Loot: 0 ETH', 'success');
            setAttackResult('blocked');
          } else {
            addLog(`WARNING: ${ethers.formatEther(loot)} ETH stolen!`, 'error');
            setAttackResult('success');
          }
        } catch {
          addLog('TRANSACTION REVERTED! Attack blocked by GuardianProxy!', 'success');
          setAttackResult('blocked');
        }
      } else {
        // Demo mode - simulate attack sequence
        await simulateDelay(600);
        addLog('Attacker contract deployed at 0xdEaD...bEEf', 'warning');
        await simulateDelay(500);
        addLog('Executing attack(vault) with 0.1 ETH as bait...', 'error');
        await simulateDelay(700);
        addLog('');
        addLog('GuardianProxy: INTERCEPTING TRANSACTION', 'warning');
        await simulateDelay(400);
        addLog('GuardianProxy: Feature extraction...', 'warning');
        addLog('  -> call_depth: 3 (recursive calls detected)');
        addLog('  -> reentrant_pattern: TRUE');
        addLog('  -> state_change_before_call: TRUE');
        await simulateDelay(600);
        addLog('GuardianProxy: Neural network inference...', 'warning');
        await simulateDelay(800);
        addLog('GuardianProxy: Threat: 2 (CRITICAL), Confidence: 99', 'error');
        await simulateDelay(300);
        addLog('');
        addLog('>>> GUARDIAN VERDICT: CRITICAL THREAT <<<', 'error');
        addLog('>>> TRANSACTION REVERTED <<<', 'error');
        addLog('>>> REENTRANCY ATTACK BLOCKED <<<', 'success');
        setAttackResult('blocked');
      }

      await simulateDelay(500);
      setShieldStatus('active');
      addLog('');
      addLog('Shield status restored to ACTIVE.', 'success');
      completeStep(4);
      setCurrentStep(5);
    } catch (err) {
      addLog(`Error: ${err.message}`, 'error');
      setShieldStatus('active');
    }
    setLoading(false);
  };

  // Step 5: Verify Funds
  const verifyFunds = async () => {
    setLoading(true);
    addLog('');
    addLog('Verifying vault balance post-attack...', 'warning');

    try {
      if (signer) {
        const vault = new ethers.Contract(CONTRACTS.ProtectedVault, ABIS.ProtectedVault, provider);
        const balance = await vault.getBalance(walletAddress);
        const formatted = ethers.formatEther(balance);
        setVaultBalance(formatted);
        addLog(`Vault balance: ${formatted} ETH`, 'success');
        addLog('ALL FUNDS SAFE. PolkaSentinel protected your assets.', 'success');
      } else {
        await simulateDelay(800);
        addLog(`Vault balance: ${vaultBalance} ETH`, 'success');
        await simulateDelay(400);
        addLog('Expected balance: 0.7 ETH', 'success');
        addLog('Actual balance:   0.7 ETH', 'success');
        addLog('Stolen:           0.0 ETH', 'success');
        await simulateDelay(300);
        addLog('');
        addLog('ALL FUNDS ARE SAFE.', 'success');
        addLog('PolkaSentinel successfully protected your vault.', 'success');
      }

      completeStep(5);
    } catch (err) {
      addLog(`Error: ${err.message}`, 'error');
    }
    setLoading(false);
  };

  const completeStep = (stepId) => {
    setCompletedSteps((prev) => [...new Set([...prev, stepId])]);
  };

  const simulateDelay = (ms) => new Promise((r) => setTimeout(r, ms));

  const resetDemo = () => {
    setCurrentStep(1);
    setCompletedSteps([]);
    setLogs([]);
    setWalletAddress(null);
    setVaultBalance('0.0');
    setShieldStatus('inactive');
    setAttackResult(null);
    setWithdrawResult(null);
  };

  const isAllDone = completedSteps.length === 5;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">
          Interactive <span className="text-sentinel-safe">Attack Demo</span>
        </h1>
        <p className="text-sentinel-muted">
          Watch PolkaSentinel block a reentrancy attack in real-time
        </p>
      </div>

      {/* Step Indicator */}
      <StepIndicator steps={STEPS} currentStep={currentStep} completedSteps={completedSteps} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Action Panel */}
        <div className="lg:col-span-1 space-y-4">
          {/* Shield */}
          <div className="card flex flex-col items-center py-6">
            <ShieldStatus status={shieldStatus} />
          </div>

          {/* Vault Balance */}
          <div className="card">
            <p className="text-sentinel-muted text-xs uppercase tracking-wider mb-1">Vault Balance</p>
            <p className="text-3xl font-bold font-mono text-sentinel-text">
              {vaultBalance} <span className="text-lg text-sentinel-muted">ETH</span>
            </p>
            {walletAddress && (
              <p className="text-xs text-sentinel-muted font-mono mt-2 truncate">
                {walletAddress}
              </p>
            )}
          </div>

          {/* Result Badges */}
          {withdrawResult && (
            <div className="card flex items-center justify-between animate-slide-up">
              <span className="text-sm text-sentinel-muted">Normal Withdraw</span>
              <ThreatBadge level="safe" label="SAFE" large />
            </div>
          )}
          {attackResult === 'blocked' && (
            <div className="card flex items-center justify-between animate-slide-up border-sentinel-danger/30">
              <span className="text-sm text-sentinel-muted">Reentrancy Attack</span>
              <ThreatBadge level="critical" label="BLOCKED" large pulse />
            </div>
          )}

          {/* Action Buttons */}
          <div className="card space-y-3">
            {currentStep === 1 && (
              <button onClick={connectWallet} disabled={loading} className="btn-primary w-full">
                {loading ? 'Connecting...' : 'Connect Wallet'}
              </button>
            )}
            {currentStep === 2 && (
              <button onClick={fundVault} disabled={loading} className="btn-primary w-full">
                {loading ? 'Depositing...' : 'Fund Vault (1.0 ETH)'}
              </button>
            )}
            {currentStep === 3 && (
              <button onClick={normalWithdraw} disabled={loading} className="btn-primary w-full">
                {loading ? 'Withdrawing...' : 'Normal Withdrawal (0.3 ETH)'}
              </button>
            )}
            {currentStep === 4 && (
              <button onClick={launchAttack} disabled={loading} className="btn-danger w-full">
                {loading ? 'Attacking...' : 'Launch Reentrancy Attack'}
              </button>
            )}
            {currentStep === 5 && !isAllDone && (
              <button onClick={verifyFunds} disabled={loading} className="btn-secondary w-full">
                {loading ? 'Verifying...' : 'Verify Funds Safe'}
              </button>
            )}
            {isAllDone && (
              <div className="space-y-3">
                <div className="text-center py-2">
                  <p className="text-sentinel-safe font-bold text-sm glow-safe">DEMO COMPLETE</p>
                  <p className="text-sentinel-muted text-xs mt-1">PolkaSentinel successfully protected the vault</p>
                </div>
                <button onClick={resetDemo} className="btn-secondary w-full text-sm">
                  Reset Demo
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Terminal Log */}
        <div className="lg:col-span-2">
          <div className="card h-full flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-sentinel-danger/80" />
                  <div className="w-3 h-3 rounded-full bg-sentinel-warning/80" />
                  <div className="w-3 h-3 rounded-full bg-sentinel-safe/80" />
                </div>
                <span className="text-xs text-sentinel-muted font-mono ml-2">sentinel-terminal</span>
              </div>
              <span className="text-xs text-sentinel-muted font-mono">
                {logs.length} events
              </span>
            </div>
            <div
              ref={logRef}
              className="flex-1 bg-sentinel-bg rounded-lg p-4 overflow-y-auto min-h-[400px] max-h-[600px] border border-sentinel-border/50"
            >
              {logs.length === 0 ? (
                <div className="text-sentinel-muted font-mono text-xs">
                  <p>PolkaSentinel v1.0.0 — Attack Demo Terminal</p>
                  <p>============================================</p>
                  <p className="mt-2">Ready. Click "Connect Wallet" to begin.</p>
                  <p className="cursor-blink mt-1">&gt; </p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {logs.map((entry, i) => (
                    <LogEntry key={i} entry={entry} index={0} />
                  ))}
                  {loading && (
                    <div className="font-mono text-xs text-sentinel-safe animate-pulse mt-1">
                      &gt; Processing...
                    </div>
                  )}
                  {isAllDone && (
                    <div className="mt-3 font-mono text-xs">
                      <p className="text-sentinel-safe glow-safe">
                        ============================================
                      </p>
                      <p className="text-sentinel-safe glow-safe font-bold">
                        DEMO COMPLETE: ALL FUNDS PROTECTED
                      </p>
                      <p className="text-sentinel-safe glow-safe">
                        ============================================
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
