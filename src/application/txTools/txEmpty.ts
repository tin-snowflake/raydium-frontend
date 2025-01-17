import txHandler, { SingleTxOptions, HandleFnOptions } from '@/application/txTools/handleTx'
import { createTransactionCollector } from '@/application/txTools/createTransaction'

export default async function txEmpty(options: SingleTxOptions & HandleFnOptions) {
  return txHandler(
    async ({ transactionCollector, baseUtils: { owner, connection, tokenAccounts } }) => {
      const piecesCollection = createTransactionCollector()
      transactionCollector.add(await piecesCollection.spawnTransaction(), {
        ...options,
        txHistoryInfo: {
          title: 'Debug'
        }
      })
    },
    { forceKeyPairs: options.forceKeyPairs }
  )
}
