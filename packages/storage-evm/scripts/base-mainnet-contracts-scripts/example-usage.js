/**
 * Energy Distribution System - Basic Usage Example
 * 
 * This example shows how to:
 * 1. Distribute energy from multiple sources
 * 2. Consume energy with automatic optimization
 * 3. Check balances and system state
 */

const { ethers } = require('ethers');

// Contract ABI (minimal for this example)
const CONTRACT_ABI = [
    "function distributeEnergyTokens((uint256,uint256,uint256,bool)[] sources, uint256 batteryState)",
    "function consumeEnergyTokens((uint256,uint256)[] consumptionRequests)", 
    "function getCashCreditBalance(address member) view returns (int256)",
    "function getCollectiveConsumption() view returns ((address,uint256,uint256)[])",
    "function verifyZeroSumProperty() view returns (bool, int256)",
    "function getImportCashCreditBalance() view returns (int256)",
    "function getExportCashCreditBalance() view returns (int256)"
];

// Helper functions for price/balance conversion
function parseUSDC(dollarAmount) {
    return ethers.parseUnits(dollarAmount.toString(), 6);
}

function formatUSDC(rawAmount) {
    return (Number(rawAmount) / 1000000).toFixed(2);
}

async function runEnergyExample() {
    // Setup (replace with your actual provider and contract address)
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    const contract = new ethers.Contract("0x02d88b0C4CC3A4AE86482056c25d65916Dd6DD95", CONTRACT_ABI, signer);

    try {
        console.log("🔋 Energy Distribution Example\n");

        // ==================== STEP 1: DISTRIBUTE ENERGY ====================
        console.log("📊 Step 1: Distributing energy from multiple sources");
        
        const energySources = [
            {
                sourceId: 1,                          // Solar farm
                price: parseUSDC(0.08),              // $0.08 per kWh
                quantity: 150,                       // 150 kWh
                isImport: false                      // Local production
            },
            {
                sourceId: 2,                          // Wind farm  
                price: parseUSDC(0.12),              // $0.12 per kWh
                quantity: 100,                       // 100 kWh
                isImport: false                      // Local production
            },
            {
                sourceId: 3,                          // Grid import
                price: parseUSDC(0.30),              // $0.30 per kWh (expensive)
                quantity: 80,                        // 80 kWh
                isImport: true                       // Grid import
            }
        ];

        console.log("Energy sources:");
        energySources.forEach((source, i) => {
            const type = source.isImport ? "Import" : "Local";
            console.log(`  ${i+1}. ${type}: ${source.quantity} kWh at $${formatUSDC(source.price)}/kWh`);
        });

        const batteryState = 0; // Battery starts empty
        console.log(`Battery state: ${batteryState} kWh\n`);

        // Execute distribution
        console.log("⏳ Distributing energy...");
        const distributeTx = await contract.distributeEnergyTokens(energySources, batteryState);
        await distributeTx.wait();
        console.log("✅ Energy distribution complete!\n");

        // ==================== STEP 2: CHECK AVAILABLE ENERGY ====================
        console.log("📋 Step 2: Checking available energy pool");
        
        const energyPool = await contract.getCollectiveConsumption();
        let totalMemberEnergy = 0;
        let totalImportEnergy = 0;
        
        console.log("Available energy batches:");
        energyPool.forEach((batch, i) => {
            if (Number(batch.quantity) > 0) {
                const isImport = batch.owner === "0x0000000000000000000000000000000000000000";
                const ownerType = isImport ? "Import" : "Member";
                console.log(`  Batch ${i+1}: ${batch.quantity} kWh at $${formatUSDC(batch.price)}/kWh (${ownerType})`);
                
                if (isImport) {
                    totalImportEnergy += Number(batch.quantity);
                } else {
                    totalMemberEnergy += Number(batch.quantity);
                }
            }
        });
        console.log(`Total: ${totalMemberEnergy} kWh member-owned + ${totalImportEnergy} kWh imports\n`);

        // ==================== STEP 3: CONSUME ENERGY ====================
        console.log("⚡ Step 3: Consuming energy");

        const consumptionRequests = [
            { deviceId: 1, quantity: 40 },    // Household 1: 40 kWh
            { deviceId: 2, quantity: 35 },    // Household 2: 35 kWh  
            { deviceId: 3, quantity: 25 },    // Household 3: 25 kWh
        ];

        console.log("Consumption requests:");
        consumptionRequests.forEach((req, i) => {
            console.log(`  Household ${req.deviceId}: ${req.quantity} kWh`);
        });

        console.log("\n⏳ Processing consumption (automatic price optimization)...");
        const consumeTx = await contract.consumeEnergyTokens(consumptionRequests);
        await consumeTx.wait();
        console.log("✅ Energy consumption complete!\n");

        // ==================== STEP 4: CHECK RESULTS ====================
        console.log("💰 Step 4: Checking member balances");

        // Example household addresses (replace with actual addresses)
        const households = [
            "0x2687fe290b54d824c136Ceff2d5bD362Bc62019a", // Household 1
            "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", // Household 2  
            "0x90F79bf6EB2c4f870365E785982E1f101E93b906", // Household 3
            "0x4B20993Bc481177ec7E8f571ceCaE8A9e22C02db", // Household 4
            "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"  // Household 5
        ];

        for (let i = 0; i < households.length; i++) {
            const [balance] = await contract.getCashCreditBalance(households[i]);
            const status = Number(balance) >= 0 ? "Credit" : "Owes";
            console.log(`  Household ${i+1}: $${formatUSDC(Math.abs(Number(balance)))} ${status}`);
        }

        // ==================== STEP 5: VERIFY SYSTEM INTEGRITY ====================
        console.log("\n🔍 Step 5: System verification");

        const [isZeroSum, totalBalance] = await contract.verifyZeroSumProperty();
        console.log(`Zero-sum status: ${isZeroSum ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`Total system balance: $${formatUSDC(totalBalance)}`);

        const importBalance = await contract.getImportCashCreditBalance();
        const exportBalance = await contract.getExportCashCreditBalance();
        console.log(`Import balance: $${formatUSDC(importBalance)}`);
        console.log(`Export balance: $${formatUSDC(exportBalance)}`);

        console.log("\n🎉 Energy distribution cycle completed successfully!");

    } catch (error) {
        console.error("❌ Error:", error.message);
        if (error.reason) {
            console.error("Reason:", error.reason);
        }
    }
}

// Export for use in other scripts
module.exports = {
    parseUSDC,
    formatUSDC,
    runEnergyExample
};

// Run if called directly
if (require.main === module) {
    runEnergyExample().catch(console.error);
} 