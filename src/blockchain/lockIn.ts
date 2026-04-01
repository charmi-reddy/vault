import algosdk from "algosdk";
import { getAlgodClient } from "./algodClient";

export const lockInAssets = async (
  sender: string,
  appId: number,
  lockDays: number,
  peraWallet: any
): Promise<{ txId: string; confirmedRound: number | null }> => {
  try {
    if (!Number.isInteger(appId) || appId <= 0) {
      throw new Error("Invalid App ID");
    }

    if (!Number.isInteger(lockDays) || lockDays <= 0) {
      throw new Error("Lock duration must be at least 1 day");
    }

    const algodClient = getAlgodClient();

    const params = await algodClient.getTransactionParams().do();

    // 📞 App Call: Lock-in
    const lockInMethod = new algosdk.ABIMethod({
      name: "lockIn",
      args: [{ type: "uint64" }],
      returns: { type: "void" },
    });

    const appCallTxn = algosdk.makeApplicationNoOpTxnFromObject({
      sender,
      appIndex: appId,
      appArgs: [
        lockInMethod.getSelector(),
        algosdk.encodeUint64(lockDays),
      ],
      suggestedParams: params,
    });

    const txGroup = [
      { txn: appCallTxn, signers: [sender] },
    ];

    const signedTxn = await peraWallet.signTransaction([txGroup]);

    const txResponse = await algodClient.sendRawTransaction(signedTxn).do();
    const confirmation = await algosdk.waitForConfirmation(algodClient, txResponse.txid, 4);

    console.log("✅ Lock-in successful:", txResponse.txid);

    const confirmedRound = Number(
      (confirmation as unknown as { ["confirmed-round"]?: number })["confirmed-round"] ?? 0
    );

    return {
      txId: txResponse.txid,
      confirmedRound: confirmedRound || null,
    };
  } catch (error) {
    console.error("Lock-in failed:", error);

    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("no funds")) {
      throw new Error("You must have savings to lock-in assets.");
    }

    throw error;
  }
};
