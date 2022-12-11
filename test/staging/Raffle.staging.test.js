const { assert, expect } = require("chai");
const { network, getNamedAccounts, ethers, deployments } = require("hardhat");
const { developmentChains } = require("../../helper-hardhat-config");




    developmentChains.includes(network.name) ? describe.skip 
    : describe("fulfillRandomWords",  function(){
        let raffle, deployer, entranceFee



        beforeEach(async function(){
            deployer = (await getNamedAccounts()).deployer
            raffle = await ethers.getContract("Raffle", deployer)
            entranceFee = await raffle.getentranceFee()
        })


        it("should pick a winner, reset the lottery, fund the winner/send money", async function(){
            const accounts = await ethers.getSigners()
            const startingTimestamp = await raffle.getLatestTimeStamp()
            await new Promise(async (resolve, reject) =>{
                resolve()

                raffle.once("winnerPicked",  async () => {
                    console.log('Winner picked and event fired!')
                    try {
                        const recentWinners = await raffle.getRecentWinner()
                        const raffleState = await raffle.getRaffleState()
                        const winnerEndingBalance = await accounts[0].getBalance()
                        const endingTimestamp = await raffle.getLatestTimeStamp()


                        await expect(raffle.getPlayers(0)).to.be.reverted
                        assert.equal(recentWinners,  accounts[0].address)
                        assert.equal(raffleState.toString(), "0")
                        assert.equal(winnerEndingBalance.toString(), winnerStartingBalance.add(entranceFee).toString())
                        assert(endingTimestamp > startingTimestamp)
                    } catch (error) {
                        reject(error)
                    }
                })

                await raffle.enterRaffle({value: entranceFee})
                const winnerStartingBalance = await accounts[0].getBalance()
            })

        })
    })