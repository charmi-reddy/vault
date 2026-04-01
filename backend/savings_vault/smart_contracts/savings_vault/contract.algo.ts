import { Contract, abimethod } from '@algorandfoundation/algorand-typescript'
import { Global, LocalState, Txn, Uint64, assert, gtxn, type uint64 } from '@algorandfoundation/algorand-typescript'

export class SavingsVault extends Contract {

  // ✅ Define local state
  totalSaved = LocalState<uint64>()
  lockExpiry = LocalState<uint64>()  // Lock expiration time (0 = not locked)

  // ✅ Opt-in
  @abimethod({ allowActions: ['OptIn', 'NoOp'] })
  optIn(): void {
    this.totalSaved(Txn.sender).value = Uint64(0)
    this.lockExpiry(Txn.sender).value = Uint64(0)
  }

  // 💰 Deposit
  @abimethod()
  deposit(): void {

    // Get previous transaction (payment)
    const paymentTxn = gtxn.PaymentTxn(Txn.groupIndex - 1)

    // Validate payment
    assert(paymentTxn.amount > 0)
    assert(paymentTxn.receiver === Global.currentApplicationAddress)

    // Update savings
    const current = this.totalSaved(Txn.sender).value
    this.totalSaved(Txn.sender).value = current + paymentTxn.amount
  }

  // 🔒 Lock-in (prevents withdrawal for specified duration)
  @abimethod()
  lockIn(lockDays: uint64): void {
    // Validate user has savings
    assert(this.totalSaved(Txn.sender).value > 0)
    
    // Calculate lock expiry (current time + days in microseconds)
    const lockDurationMicroseconds: uint64 = lockDays * Uint64(86400000000)
    this.lockExpiry(Txn.sender).value = Global.latestTimestamp + lockDurationMicroseconds
  }

  // 💸 Withdraw (only if not locked)
  @abimethod()
  withdraw(amount: uint64): void {
    // Check if not locked
    const currentLockExpiry = this.lockExpiry(Txn.sender).value
    assert(currentLockExpiry === Uint64(0) || Global.latestTimestamp > currentLockExpiry)
    
    // Validate amount
    const userSavings = this.totalSaved(Txn.sender).value
    assert(amount > 0)
    assert(amount <= userSavings)
    
    // Update savings (contract tracks the state, app address must send funds back via group txn)
    this.totalSaved(Txn.sender).value = userSavings - amount
  }
}