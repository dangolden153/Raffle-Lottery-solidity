const { assert, expect } = require("chai");
const { network, getNamedAccounts, ethers, deployments } = require("hardhat");
const { developmentChains, networkConfig } = require("../../helper-hardhat-config");




    !developmentChains.includes(network.name) ? describe.skip 
    : describe("Raffle unit test", async function(){
        let raffle, vrfCoordinatorV2Mock, deployer, entranceFee, interval
        const chainId = network.config.chainId



        beforeEach(async function(){
            deployer = (await getNamedAccounts()).deployer
            await deployments.fixture(["all"])
            raffle = await ethers.getContract("Raffle", deployer)
            vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer)
             entranceFee = await raffle.getentranceFee()
             interval = await raffle.getRaffleInterval()
        })

        describe("Constructor", async function(){

            it("Initializes the raffle correctly", async function(){
                const raffleState = await raffle.getRaffleState()
                
                assert.equal(raffleState.toString(), "0")
                assert.equal(interval.toString(), networkConfig[chainId]["keepersUpdateInterval"])
            })
        })
        
        describe("enterRaffle", function(){
            it("reverts when not paid enough!", async function(){
               await expect(raffle.enterRaffle()).to.be.revertedWith("Raffle__NotEnoughEth")
            })

            it("should store players when they entered", async function(){
                //get raffle player
                // check the state after deployment; and the player === deployer
               await raffle.enterRaffle({value: entranceFee})
               const playerFromContract = await raffle.getPlayers(0)
               assert.equal(playerFromContract, deployer)
            })

            it("should emit an event when entered!", async function(){
                await expect(raffle.enterRaffle({value: entranceFee})).to.emit(raffle, "RaffleEnter")
            })

            it("should not allow entrance when raffle state is not open", async function(){
                // checkUpKeep should return true to set the state to calculating
                await raffle.enterRaffle({value: entranceFee})
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                await network.provider.request({ method: "evm_mine", params: [] })
                //we pretend to be chainlink keeper
                await raffle.performUpkeep([])
                await expect(raffle.enterRaffle({value: entranceFee})).to.be.revertedWith("Raffle__NotOpen")
            })
            
        })


        describe("checkUpKeep", function(){
            it("should return false when no Eth is sent", async function(){
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                await network.provider.send("evm_mine", [])
                const {upKeepNeeded} =  await raffle.callStatic.checkUpkeep([])
                assert(!upKeepNeeded)
            })

            it("should return false when raffle is not open", async function(){
                await raffle.enterRaffle({value: entranceFee})
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                await network.provider.request({ method: "evm_mine", params: [] })
                await raffle.performUpkeep([]) 
                const raffleState = await raffle.getRaffleState()
                const {upkeepNeeded} =  await raffle.callStatic.checkUpkeep([])
                assert.equal(raffleState.toString(), "1")
                assert.equal(upkeepNeeded, false)
            })
        })


        describe("performUpKeep", function(){
            it("should run if checkUpKeep is true", async function(){
                await raffle.enterRaffle({value: entranceFee})
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                await network.provider.request({ method: "evm_mine", params: [] })
                const tx = await raffle.performUpkeep([])
                assert(tx)
                // const {upkeepNeeded} =  await raffle.callStatic.checkUpkeep([])
                // assert.equal(upkeepNeeded, true)
            })

            it("should revert when checkUpKeep is false", async function(){
                await expect( raffle.performUpkeep([])).to.be.revertedWith("Raffle__UpKeepNotNeeded")
              
            })

            it("update raffle state, emit event, and calls the vrf coordinator", async function(){
                await raffle.enterRaffle({value: entranceFee})
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                await network.provider.request({ method: "evm_mine", params: [] })
                const txResponse = await raffle.performUpkeep([])
                const txReceipt = await txResponse.wait(1)
                const requestId = txReceipt.events[1].args.requestId
                const raffleState = await raffle.getRaffleState()
                assert(requestId.toNumber() > 0)
                assert(raffleState.toString() == "1")
            })
        })


        describe("fulfillRandomWords", function(){

            beforeEach(async function(){
                await raffle.enterRaffle({value: entranceFee})
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                await network.provider.request({ method: "evm_mine", params: [] })
            })


            it("it can only be called after performUpKeep", async function(){
                await expect(vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.address)).to.be.revertedWith("nonexistent request")
                await expect(vrfCoordinatorV2Mock.fulfillRandomWords(1, raffle.address)).to.be.revertedWith("nonexistent request")
            })

            it("should pick a winner, reset the lottery, fund the winner/send money", async () => {
               const additionalAccounts = 3
               const startingIndex = 1
               const accounts = await ethers.getSigners()

               for (let i = startingIndex; i < startingIndex  + additionalAccounts; i++){
                    const accountConnetedRaffle =  raffle.connect(accounts[i])
                    await accountConnetedRaffle.enterRaffle({value: entranceFee})
               }

               const startLastTimestamp = await raffle.getLatestTimeStamp()

               //performUpKeep (mock bieng the chainlink keeper)
               // fulfillRandomWords (mock bieng the chainlink vrf)
               // should wait for the fulfillRandomWords to be call


              await new Promise(async(resolve, reject) =>{
                raffle.once("winnerPicked" , async () =>{
                    console.log("found the event!")
                   
                    try {
                        const recentWinners = await raffle.getRecentWinner()
                        console.log('recentWinners', recentWinners)
                        console.log(await accounts[0].address)
                        console.log(await accounts[1].address)
                        console.log(await accounts[2].address)
                        console.log(await accounts[3].address)
                        console.log(await accounts[4].address)
                        const raffleState = await raffle.getRaffleState()
                        const endingTimestamp = await raffle.getLatestTimeStamp()
                        const numPlayers = await raffle.getNumberPlayers()
                        const winnerEndingBalance = await accounts[1].getBalance()
                        assert(raffleState.toString() == "0")
                        assert(endingTimestamp > startLastTimestamp)
                        assert(numPlayers.toString() == "0")
                        assert(winnerEndingBalance.toString() == winnerStartingBalance.add(
                        entranceFee.mul(additionalAccounts).add(entranceFee)).toString())
                      
                    } catch (error) {
                        console.log('error', error)
                        reject(error)
                    }
               
                    resolve()
                })
                const tx = await raffle.performUpkeep("0x")
                      const txReceipt = await tx.wait(1)
                      const winnerStartingBalance = await accounts[1].getBalance()
                      await vrfCoordinatorV2Mock.fulfillRandomWords(
                          txReceipt.events[1].args.requestId,
                          raffle.address
                      )

              })

           

            })
        })
    })
