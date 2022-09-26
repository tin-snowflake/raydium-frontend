import useAppSettings from '@/application/appSettings/useAppSettings'
import txCreateConcentrated from '@/application/concentrated/txCreateConcentrated'
import useConcentrated from '@/application/concentrated/useConcentrated'
import useConcentratedAmmSelector from '@/application/concentrated/useConcentratedAmmSelector'
import useConcentratedAmountCalculator from '@/application/concentrated/useConcentratedAmountCalculator'
import useToken from '@/application/token/useToken'
import { decimalToFraction } from '@/application/txTools/decimal2Fraction'
import toFraction from '@/functions/numberish/toFraction'
import toUsdVolume from '@/functions/format/toUsdVolume'
import useWallet from '@/application/wallet/useWallet'
import Button, { ButtonHandle } from '@/components/Button'
import CoinAvatar from '@/components/CoinAvatar'
import CoinInputBox, { CoinInputBoxHandle } from '@/components/CoinInputBox'
import CyberpunkStyleCard from '@/components/CyberpunkStyleCard'
import PageLayout from '@/components/PageLayout'
import { toTokenAmount } from '@/functions/format/toTokenAmount'
import { isMeaningfulNumber } from '@/functions/numberish/compare'
import { toString } from '@/functions/numberish/toString'
import createContextStore from '@/functions/react/createContextStore'
import { useRecordedEffect } from '@/hooks/useRecordedEffect'
import { useSwapTwoElements } from '@/hooks/useSwapTwoElements'
import useToggle from '@/hooks/useToggle'
import TokenSelectorDialog from '@/pageComponents/dialogs/TokenSelectorDialog'
import { createRef, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getPriceBoundary, recordPrickTick } from '@/application/concentrated/getNearistDataPoint'
import Chart from '../../pageComponents/ConcentratedRangeChart/Chart'
import { Fraction } from 'test-r-sdk'
import { RemainSOLAlert, canTokenPairBeSelected, toXYChartFormat, PairInfoTitle } from '@/pageComponents/Concentrated'
import Decimal from 'decimal.js'

const { ContextProvider: ConcentratedUIContextProvider, useStore: useLiquidityContextStore } = createContextStore({
  hasAcceptedPriceChange: false,
  coinInputBox1ComponentRef: createRef<CoinInputBoxHandle>(),
  coinInputBox2ComponentRef: createRef<CoinInputBoxHandle>(),
  liquidityButtonComponentRef: createRef<ButtonHandle>()
})

export default function Concentrated() {
  useConcentratedAmmSelector()
  useConcentratedAmountCalculator()

  return (
    <ConcentratedUIContextProvider>
      <PageLayout mobileBarTitle="Concentrated" metaTitle="Concentrated - Raydium">
        <ConcentratedCard />
        {/* <UserLiquidityExhibition /> */}
      </PageLayout>
    </ConcentratedUIContextProvider>
  )
}

// const availableTabValues = ['Swap', 'Liquidity'] as const

function ConcentratedCard() {
  const chartPoints = useConcentrated((s) => s.chartPoints)
  const { connected } = useWallet()
  const isApprovePanelShown = useAppSettings((s) => s.isApprovePanelShown)
  const [isCoinSelectorOn, { on: turnOnCoinSelector, off: turnOffCoinSelector }] = useToggle()
  // it is for coin selector panel
  const [targetCoinNo, setTargetCoinNo] = useState<'1' | '2'>('1')
  const priceRef = useRef<(Fraction | undefined)[]>([])
  const checkWalletHasEnoughBalance = useWallet((s) => s.checkWalletHasEnoughBalance)
  const { coin1, coin1Amount, coin2, coin2Amount, focusSide, refreshConcentrated, currentAmmPool } = useConcentrated()
  const refreshTokenPrice = useToken((s) => s.refreshTokenPrice)

  const decimals = coin1 || coin2 ? Math.max(coin1?.decimals ?? 0, coin2?.decimals ?? 0) : 6
  let points = useMemo(() => (chartPoints ? toXYChartFormat(chartPoints) : undefined), [chartPoints])
  const isFocus1 = focusSide === 'coin1'
  if (!isFocus1) points = points?.map((p) => ({ x: 1 / p.x, y: p.y })).reverse()

  const { coinInputBox1ComponentRef, coinInputBox2ComponentRef, liquidityButtonComponentRef } =
    useLiquidityContextStore()

  const swapElementBox1 = useRef<HTMLDivElement>(null)
  const swapElementBox2 = useRef<HTMLDivElement>(null)
  const [, { toggleSwap: toggleUISwap }] = useSwapTwoElements(swapElementBox1, swapElementBox2)
  useRecordedEffect(
    ([prevFocusSide]) => {
      if (prevFocusSide && prevFocusSide !== focusSide) {
        toggleUISwap()
      }
    },
    [focusSide]
  )

  const haveEnoughCoin1 =
    coin1 && checkWalletHasEnoughBalance(toTokenAmount(coin1, coin1Amount, { alreadyDecimaled: true }))
  const haveEnoughCoin2 =
    coin2 && checkWalletHasEnoughBalance(toTokenAmount(coin2, coin2Amount, { alreadyDecimaled: true }))

  const cardRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    useConcentrated.setState({
      scrollToInputBox: () => cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }, [cardRef])

  const boundaryData = useMemo(
    () => getPriceBoundary({ coin1, coin2, ammPool: currentAmmPool, reverse: focusSide !== 'coin1' }),
    [coin1, coin2, currentAmmPool, focusSide]
  )

  const totalDeposit = priceRef.current
    .filter((p) => !!p)
    .reduce((acc, cur) => {
      const newAcc = acc!.add(toFraction(cur!))

      return newAcc
    }, new Fraction(0))

  const ratio1 = parseFloat(
    priceRef.current[0] ? priceRef.current[0].div(totalDeposit!).mul(100).toFixed(1, undefined, 0) : '0'
  )
  const ratio2 = priceRef.current[1] ? parseFloat((100 - Number(ratio1)).toFixed(1)) : '0'

  const handlePosChange = useCallback(
    (props) => {
      if (!currentAmmPool) return
      const res = recordPrickTick({
        p: props.min,
        coin1,
        coin2,
        ammPool: currentAmmPool,
        reverse: !isFocus1
      })
      console.log(123123, res, res?.price.toFixed(6))
      const res2 = recordPrickTick({
        p: props.max,
        coin1,
        coin2,
        ammPool: currentAmmPool,
        reverse: !isFocus1
      })
      console.log(123123, res2, res2?.price.toFixed(6))
    },
    [coin1, coin2, currentAmmPool, isFocus1]
  )

  return (
    <CyberpunkStyleCard
      domRef={cardRef}
      wrapperClassName="md:w-[806px] w-full self-center cyberpunk-bg-light"
      className="p-6 mobile:py-5 mobile:px-3"
    >
      <PairInfoTitle
        coin1={coin1}
        coin2={coin2}
        currentPrice={currentAmmPool?.state.currentPrice}
        focusSide={focusSide}
        onChangeFocus={(focusSide) => useConcentrated.setState({ focusSide })}
      />

      <div className="flex flex-gap-1 gap-2.5 mb-10">
        <div className="bg-dark-blue rounded-xl flex flex-col justify-between flex-1 px-3 py-4">
          <div>
            <div className="text-base leading-[22px] text-secondary-title mb-5">Deposit Amount</div>

            {/* input twin */}
            <>
              <CoinInputBox
                className="mt-5 mb-4 mobile:mt-0 border border-light-blue-opacity"
                disabled={isApprovePanelShown}
                noDisableStyle
                componentRef={coinInputBox1ComponentRef}
                domRef={swapElementBox1}
                value={toString(coin1Amount)}
                haveHalfButton
                haveCoinIcon
                showTokenSelectIcon
                topLeftLabel=""
                onPriceChange={(price: Fraction | undefined) => {
                  priceRef.current[0] = price
                }}
                onTryToTokenSelect={() => {
                  turnOnCoinSelector()
                  setTargetCoinNo('1')
                }}
                onUserInput={(amount) => {
                  useConcentrated.setState({ coin1Amount: amount, userCursorSide: 'coin1' })
                }}
                onEnter={(input) => {
                  if (!input) return
                  if (!coin2) coinInputBox2ComponentRef.current?.selectToken?.()
                  if (coin2 && coin2Amount) liquidityButtonComponentRef.current?.click?.()
                }}
                token={coin1}
              />

              <CoinInputBox
                className="border border-light-blue-opacity"
                componentRef={coinInputBox2ComponentRef}
                domRef={swapElementBox2}
                disabled={isApprovePanelShown}
                noDisableStyle
                value={toString(coin2Amount)}
                haveHalfButton
                haveCoinIcon
                showTokenSelectIcon
                topLeftLabel=""
                onPriceChange={(price: Fraction | undefined) => (priceRef.current[1] = price)}
                onTryToTokenSelect={() => {
                  turnOnCoinSelector()
                  setTargetCoinNo('2')
                }}
                onEnter={(input) => {
                  if (!input) return
                  if (!coin1) coinInputBox1ComponentRef.current?.selectToken?.()
                  if (coin1 && coin1Amount) liquidityButtonComponentRef.current?.click?.()
                }}
                onUserInput={(amount) => {
                  useConcentrated.setState({ coin2Amount: amount, userCursorSide: 'coin2' })
                }}
                token={coin2}
              />
            </>

            <div className="mt-4 border border-secondary-title border-opacity-50  rounded-xl px-3 py-4">
              <div className="flex justify-between mb-4">
                <span className="text-sm leading-[18px] text-secondary-title">Total Deposit</span>
                <span className="text-lg leading-[18px]">{toUsdVolume(totalDeposit)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm leading-[18px] text-secondary-title">Deposit Ratio</span>
                <span className="text-lg flex leading-[18px]">
                  <CoinAvatar className="z-10 inline-block" noCoinIconBorder size="sm" token={coin1} />
                  <CoinAvatar className="-ml-2 inline-block mr-2" noCoinIconBorder size="sm" token={coin2} />
                  {ratio1}% / {ratio2}%
                </span>
              </div>
            </div>
          </div>

          {/* supply button */}
          <Button
            className="frosted-glass-teal w-full mt-5"
            componentRef={liquidityButtonComponentRef}
            isLoading={isApprovePanelShown}
            validators={[
              {
                should: connected,
                forceActive: true,
                fallbackProps: {
                  onClick: () => useAppSettings.setState({ isWalletSelectorShown: true }),
                  children: 'Connect Wallet'
                }
              },
              {
                should: coin1 && coin2,
                fallbackProps: { children: 'Select a token' }
              },
              {
                should: isMeaningfulNumber(coin1Amount) || isMeaningfulNumber(coin2Amount),
                fallbackProps: { children: 'Enter an amount' }
              }
              // {
              //   should: haveEnoughCoin1,
              //   fallbackProps: { children: `Insufficient ${coin1?.symbol ?? ''} balance` }
              // },
              // {
              //   should: haveEnoughCoin2,
              //   fallbackProps: { children: `Insufficient ${coin2?.symbol ?? ''} balance` }
              // },
            ]}
            onClick={() => {
              txCreateConcentrated()
            }}
          >
            Add Concentrated
          </Button>
          <RemainSOLAlert />
        </div>

        <div className="bg-dark-blue min-h-[180px] rounded-xl flex-1 px-3 py-4">
          <div className="text-base leading-[22px] text-secondary-title mb-5">Set Price Range</div>
          <Chart
            chartOptions={{
              points: points || [],
              initMinBoundaryX: boundaryData?.priceLower,
              initMaxBoundaryX: boundaryData?.priceUpper
            }}
            currentPrice={
              currentAmmPool
                ? decimalToFraction(
                    isFocus1 ? currentAmmPool.state.currentPrice : new Decimal(1).div(currentAmmPool.state.currentPrice)
                  )
                : undefined
            }
            decimals={decimals}
            onPositionChange={handlePosChange}
          />
          <div className="mt-4 border border-secondary-title border-opacity-50  rounded-xl px-3 py-4">
            <div className="flex justify-between items-center">
              <span className="text-sm leading-[18px] text-secondary-title">Estimated APR</span>
              <span className="text-2xl leading-[30px]">≈0%</span>
            </div>
            <div className="flex mt-[18px] border border-secondary-title border-opacity-50 rounded-xl p-2.5">
              <div className="mr-[22px]">
                <span className="text-sm leading-[18px] text-secondary-title">Rewards</span>
                <div className="flex items-center mb-2">
                  <CoinAvatar className="inline-block" noCoinIconBorder size="sm" token={coin1} />
                  <span className="text-xs text-active-cyan opacity-50 mx-1">{coin1?.symbol}</span>
                  <span className="text-sm">0%</span>
                </div>
                <div className="flex items-center">
                  <CoinAvatar className="inline-block mr-1" noCoinIconBorder size="sm" token={coin2} />
                  <span className="text-xs text-active-cyan opacity-50 mx-1">{coin2?.symbol}</span>
                  <span className="text-sm">0%</span>
                </div>
              </div>
              <div>
                <span className="text-sm leading-[18px] text-secondary-title">Fees</span>
                <div className="flex items-center mb-2">
                  <CoinAvatar className="inline-block" noCoinIconBorder size="sm" token={coin1} />
                  <span className="text-xs text-active-cyan opacity-50 mx-1">Trading Fees</span>
                  <span className="text-sm">0%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/** coin selector panel */}
      <TokenSelectorDialog
        open={isCoinSelectorOn}
        close={turnOffCoinSelector}
        onSelectCoin={(token) => {
          if (targetCoinNo === '1') {
            useConcentrated.setState({ coin1: token })
            // delete other
            if (!canTokenPairBeSelected(token, coin2)) {
              useConcentrated.setState({ coin2: undefined, coin2Amount: undefined, priceLowerTick: undefined })
            }
          } else {
            // delete other
            useConcentrated.setState({ coin2: token })
            if (!canTokenPairBeSelected(token, coin1)) {
              useConcentrated.setState({ coin1: undefined, coin1Amount: undefined, priceUpperTick: undefined })
            }
          }
          turnOffCoinSelector()
        }}
      />
    </CyberpunkStyleCard>
  )
}
