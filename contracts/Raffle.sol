//Raffle
//Enter the lottery (payable eth)
// store the player's addresses in a storage state
//Pick a varified random winner - chainlink
//Automatically fires a timeout event - chain keeper 
//Reset all states


// chainlink Oracle for randomness
// chain keeper for automated excution. 

//SPDX-Lincense-Identifier: MIT;
pragma solidity ^0.8.7;

import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AutomationCompatibleInterface.sol";



error Raffle__NotEnoughEth();
error Raffle_transferFail();
error Raffle__NotOpen();
error Raffle__UpKeepNotNeeded(uint256 currentBalance, uint256 numPlayers, uint256 raffState );



contract Raffle is VRFConsumerBaseV2, AutomationCompatibleInterface {

    /* Types decleration */
    enum RaffleState {
        OPEN,
        CALCULATING
    } // 0 = OPEN, 1 = CALCULATING
    
    // chainlink state variables
    bytes32 private immutable i_gasLane;
    uint64 private immutable i_subscriptionId;
    VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private immutable i_callbackGasLimit;
    uint32 private constant NUM_WORDS = 1;

    // state variables
    uint256 private immutable i_entranceFees;
    address payable[] private s_players;
    RaffleState private s_raffleState;

    //lottery state varaible
    address private s_recentWinner;
    uint256 private immutable i_interval;
    uint256 private s_lastTimeStamp;

    //Events
    event RaffleEnter(address indexed player);
    event requestRaffleWinner(uint256 indexed requestId);
    event winnerPicked(address indexed recentWinner);

    constructor(
        address VRFCoordinatorV2, 
        uint256 entranceFees,
        bytes32 gasLane,
        uint64 subscriptionId,
        uint32 callbackGasLimit,
        uint32 interval 
        ) VRFConsumerBaseV2(VRFCoordinatorV2){
        i_entranceFees = entranceFees;
        i_vrfCoordinator = VRFCoordinatorV2Interface(VRFCoordinatorV2);
        i_gasLane = gasLane;
        i_subscriptionId = subscriptionId;
        i_callbackGasLimit = callbackGasLimit;
        s_raffleState = RaffleState.OPEN;
        i_interval = interval;
        s_lastTimeStamp = block.timestamp;
    }


    function enterRaffle () public payable {
        // msg.val fee must be greeter than entrance, else return insufficient funds
        if(msg.value < i_entranceFees) {
            revert Raffle__NotEnoughEth();
        }

        if (s_raffleState !=  RaffleState.OPEN){
            revert Raffle__NotOpen();
        }

        s_players.push(payable(msg.sender));

        //emit an event when the dynamic array has been updated
        emit RaffleEnter(msg.sender);

    }


   
        /**
         * @dev This is a function the chainlink keeper node call
         * it looks up to the "upkeepNeeded" to return true.
         * for the following to be true in order to return true
         * 1. the time interval should exceed
         * 2. must have one player, and should be send ETH
         * 3. the subcription id should be funded with LINK
         *  4. the lottery state should be "open"
         */
     function checkUpkeep( bytes memory /* checkData */)
        public
        override
        returns (bool upkeepNeeded, bytes memory /* performData */)
    {
        bool isStateOpen = (RaffleState.OPEN == s_raffleState);
        bool hasTimePassed = ((block.timestamp - s_lastTimeStamp) > i_interval) ;
        bool isPlayerTrue = (s_players.length > 0);
        bool hasBalance = address(this).balance > 0;
        upkeepNeeded = (hasTimePassed && isPlayerTrue && hasBalance && isStateOpen);
    }


     function performUpkeep(
        bytes calldata /* performData */
    ) external override {
        (bool upkeepNeeded, ) = checkUpkeep("");
        if(!upkeepNeeded) {
            revert Raffle__UpKeepNotNeeded(address(this).balance, s_players.length,  uint256(s_raffleState));
        }
        s_raffleState = RaffleState.CALCULATING;
       uint256 requestId = i_vrfCoordinator.requestRandomWords(
            i_gasLane,
            i_subscriptionId,
            REQUEST_CONFIRMATIONS,
            i_callbackGasLimit,
            NUM_WORDS
    );
    emit requestRaffleWinner(requestId);
    }


    function fulfillRandomWords (
        uint256, //requestId 
        uint256[] memory randomWords) internal override {
        uint256 indexWinner = randomWords[0] % s_players.length;
        address payable recentWinner = s_players[indexWinner];
        s_recentWinner = recentWinner;
        s_raffleState = RaffleState.OPEN;
        s_players = new address payable[](0);
        s_lastTimeStamp = block.timestamp;
        (bool success, ) = recentWinner.call{value: address(this).balance}("");
        if(!success){
            revert Raffle_transferFail();
        }
        emit winnerPicked(recentWinner);
    }



    function getentranceFee() public view returns (uint256){
        return i_entranceFees;
    }

    function getPlayers(uint256 index) public view returns (address){
        return s_players[index];
    }

    function getRecentWinner () public view returns(address) {
        return s_recentWinner;
    }

    function getRaffleState () public view returns (RaffleState){
        return s_raffleState;
    }

    function getNumWords() public pure returns (uint256){
        return NUM_WORDS;
    }

    function getNumberPlayers() public view returns (uint256){
        return s_players.length;
    }

    function getLatestTimeStamp () public view returns(uint256){
        return s_lastTimeStamp;
    }

    function getRequestComfirmation() public pure returns(uint256){
        return REQUEST_CONFIRMATIONS;
    }

    function getRaffleInterval() public view returns(uint256){
        return i_interval;
    }
}