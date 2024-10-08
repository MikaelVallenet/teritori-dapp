import { Coin } from "@cosmjs/amino";
import { toUtf8 } from "@cosmjs/encoding";
import { isDeliverTxFailure } from "@cosmjs/stargate";

import {
  getEthereumSquadStakingQueryClient,
  getKeplrSquadStakingClient,
} from "./contracts";
import { getMetaMaskEthereumSigner } from "./ethereum";
import { getEthereumStandardNFTInfo } from "./nft";
import backpackSVG from "../../assets/game/backpack.svg";
import coinStakeSVG from "../../assets/game/coin-stake.svg";
import controllerSVG from "../../assets/game/controller.svg";
import lightningBoltSVG from "../../assets/game/lightning-bolt.svg";
import markSVG from "../../assets/game/mark.svg";
import medalSVG from "../../assets/game/medal.svg";
import nft1 from "../../assets/game/nft-1.png";
import nft2 from "../../assets/game/nft-2.png";
import nft3 from "../../assets/game/nft-3.png";
import nft4 from "../../assets/game/nft-4.png";
import nft5 from "../../assets/game/nft-5.png";
import subtractSVG from "../../assets/game/subtract.svg";
import toolSVG from "../../assets/game/tool.svg";
import { NFT } from "../api/marketplace/v1/marketplace";
import { UserScore } from "../api/p2e/v1/p2e";
import { TeritoriSquadStakingClient } from "../contracts-clients/teritori-squad-staking/TeritoriSquadStaking.client";
import { Nft as SquadStakeNFT } from "../contracts-clients/teritori-squad-staking/TeritoriSquadStaking.types";
import { TeritoriNft__factory } from "../evm-contracts-clients/teritori-nft/TeritoriNft__factory";
import { SquadStakingV3__factory } from "../evm-contracts-clients/teritori-squad-staking/SquadStakingV3__factory";
import {
  getCosmosNetwork,
  getUserId,
  mustGetCosmosNetwork,
  mustGetEthereumNetwork,
  NetworkInfo,
  NetworkKind,
  parseNftId,
  parseUserId,
} from "../networks";

import { getKeplrSigningCosmWasmClient } from "@/networks/signer";
import {
  GameBgCardItem,
  RipperRarity,
  RipperTraitType,
  SquadConfig,
  NFT as SquadNFT,
} from "@/utils/types/riot-p2e";

const round = (input: number) => {
  return Math.floor(100 * input) / 100;
};

export const parseUserScoreInfo = (userScore: UserScore) => {
  const { inProgressScore, snapshotScore, rank, snapshotRank } = userScore;

  // Duration is in seconds
  const hours = round(inProgressScore / 3600);
  const xp = round(hours * DURATION_TO_XP_COEF);

  const scoreChanges =
    Math.floor(10_000 * ((inProgressScore - snapshotScore) / snapshotScore)) /
    100;
  const rankChanges = rank - snapshotRank;

  return { xp, hours, rankChanges, scoreChanges };
};

export const durationToXP = (duration: number) => {
  // Duration is in seconds
  return Math.floor(100 * DURATION_TO_XP_COEF * (duration / 60 / 60)) / 100;
};

export const getRipperRarity = (ripper: NFT): RipperRarity => {
  let rarity: RipperRarity;

  const ripperSkin = ripper.attributes.find(
    (attr) => attr.traitType === "Skin",
  )?.value;

  switch (ripperSkin) {
    case "Pure Gold":
    case "Pure Oil":
    case "Alloy":
      rarity = "Uncommon";
      break;
    case "Aurora":
    case "Cosmos":
    case "Supernova":
      rarity = "Rare";
      break;
    case "Marble":
    case "Ice":
    case "Lava":
      rarity = "Epic";
      break;
    case "Grey Ether":
    case "Green Ether":
    case "Blue Ether":
    case "Purple Ether":
    case "Red Ether":
      rarity = "Legendary";
      break;
    case "Iron":
    case "Silver":
    case "Bronze":
    default:
      rarity = "Common";
  }
  return rarity;
};

export const getRipperTraitValue = (
  ripper: NFT,
  traitType: RipperTraitType,
) => {
  let res: any = ripper.attributes.find(
    (attr) => attr.traitType === traitType,
  )?.value;

  if (res === undefined || res === "None") {
    res = null;
  } else if (Number.isInteger(res)) {
    res = parseInt(res, 10);
  }

  return res;
};

export const getRipperTokenId = (ripperListItem: NFT) => {
  const [, , tokenId] = parseNftId(ripperListItem.id);
  return tokenId;
};

export enum StakingState {
  UNKNOWN = "UNKNOWN",
  ONGOING = "ONGOING",
  RELAX = "RELAX",
  COMPLETED = "COMPLETED",
}

export const buildApproveNFTMsg = (
  sender: string,
  spender: string,
  tokenId: string,
  nftContractAddress: string,
) => {
  return {
    typeUrl: "/cosmwasm.wasm.v1.MsgExecuteContract",
    value: {
      sender,
      msg: toUtf8(
        JSON.stringify({
          approve: {
            spender,
            token_id: tokenId,
          },
        }),
      ),
      contract: nftContractAddress,
      funds: [],
    },
  };
};

export const buildBreedingMsg = (
  sender: string,
  breedingPrice: Coin,
  tokenId1: string,
  tokeId2: string,
  contractAddress: string,
) => {
  return {
    typeUrl: "/cosmwasm.wasm.v1.MsgExecuteContract",
    value: {
      sender,
      msg: toUtf8(
        JSON.stringify({
          breed: {
            nft_token_id1: tokenId1,
            nft_token_id2: tokeId2,
          },
        }),
      ),
      contract: contractAddress,
      funds: [breedingPrice],
    },
  };
};

const buildStakingMsg = (
  sender: string,
  nfts: SquadStakeNFT[],
  contractAddress: string,
) => {
  return {
    typeUrl: "/cosmwasm.wasm.v1.MsgExecuteContract",
    value: {
      sender,
      msg: toUtf8(
        JSON.stringify({
          stake: {
            nfts,
          },
        }),
      ),
      contract: contractAddress,
      funds: [],
    },
  };
};

export const gameBgData: GameBgCardItem[] = [
  { id: 1, type: "BLANK" },
  { id: 2, type: "BLANK" },
  { id: 3, type: "BLANK" },
  { id: 4, type: "BLANK" },
  { id: 5, type: "BLANK" },
  { id: 6, type: "BLANK" },
  { id: 7, type: "BLANK" },
  {
    id: 8,
    type: "POINTS",
    data: {
      label: "Luck",
      value: "13.6",
    },
  },
  {
    id: 9,
    type: "BLANK",
  },
  {
    id: 10,
    type: "IMAGE",
    data: {
      source: nft1,
    },
  },
  {
    id: 11,
    type: "IMAGE",
    data: {
      source: nft2,
    },
  },
  { id: 12, type: "BLANK" },
  {
    id: 13,
    type: "POINTS",
    data: {
      label: "Stamina",
      value: "10.7",
    },
  },
  { id: 14, type: "BLANK" },
  { id: 15, type: "BLANK" },
  { id: 16, type: "BLANK" },
  {
    id: 17,
    type: "IMAGE",
    data: {
      source: nft3,
    },
  },
  { id: 18, type: "BLANK" },
  { id: 19, type: "BLANK" },
  { id: 20, type: "BLANK" },
  {
    id: 21,
    type: "ICON",
    data: {
      source: markSVG,
    },
  },
  {
    id: 22,
    type: "ICON",
    data: {
      source: subtractSVG,
    },
  },
  {
    id: 23,
    type: "ICON",
    data: {
      source: backpackSVG,
    },
  },
  {
    id: 24,
    type: "ICON",
    data: {
      source: toolSVG,
    },
  },
  { id: 25, type: "BLANK" },
  { id: 26, type: "BLANK" },
  {
    id: 27,
    type: "ICON",
    data: {
      source: medalSVG,
    },
  },
  {
    id: 28,
    type: "ICON",
    data: {
      source: lightningBoltSVG,
    },
  },
  {
    id: 29,
    type: "ICON",
    data: {
      source: controllerSVG,
    },
  },
  {
    id: 30,
    type: "ICON",
    data: {
      source: coinStakeSVG,
    },
  },
  { id: 31, type: "BLANK" },
  { id: 32, type: "BLANK" },
  { id: 33, type: "BLANK" },
  {
    id: 34,
    type: "IMAGE",
    data: {
      source: nft4,
    },
  },
  { id: 35, type: "BLANK" },
  {
    id: 36,
    type: "POINTS",
    data: {
      label: "Protection",
      value: "12.8",
    },
  },
  { id: 37, type: "BLANK" },
  { id: 38, type: "BLANK" },
  { id: 39, type: "BLANK" },
  { id: 40, type: "BLANK" },
  { id: 41, type: "BLANK" },
  { id: 42, type: "BLANK" },
  { id: 43, type: "BLANK" },
  {
    id: 44,
    type: "POINTS",
    data: {
      label: "hp",
      value: "9.9",
    },
  },
  { id: 45, type: "BLANK" },
  { id: 46, type: "BLANK" },
  { id: 47, type: "BLANK" },
  {
    id: 48,
    type: "IMAGE",
    data: {
      source: nft5,
    },
  },
  { id: 49, type: "BLANK" },
  { id: 50, type: "BLANK" },
];

export const isNFTStaked = (ripper: NFT | undefined) => {
  if (!ripper) return false;

  const network = getCosmosNetwork(ripper.networkId);

  if (!network) return false;

  const ids: string[] = [];

  const v1Id = getUserId(network.id, network.riotSquadStakingContractAddressV1);
  if (v1Id) {
    ids.push(v1Id);
  }
  const v2Id = getUserId(network.id, network.riotSquadStakingContractAddressV2);
  if (v2Id) {
    ids.push(v2Id);
  }

  return ids.includes(ripper.lockedOn);
};

const SQUAD_STAKE_COEF = 0.125; // Duration (in hours) = 0.125 * stamin
const DURATION_TO_XP_COEF = 100; // XP = 100 * duration (in hours)

export const squadWithdrawSeason1 = async (userId: string | undefined) => {
  const [network, userAddress] = parseUserId(userId);
  if (!network || !userAddress) {
    return null;
  }

  const cosmosNetwork = getCosmosNetwork(network.id);
  const contractAddress = cosmosNetwork?.riotSquadStakingContractAddressV1;

  if (!contractAddress) {
    return null;
  }

  const signingClient = await getKeplrSigningCosmWasmClient(network.id);
  const client = new TeritoriSquadStakingClient(
    signingClient,
    userAddress,
    contractAddress,
  );
  return await client.withdraw();
};

const cosmosSquadWithdraw = async (userId: string) => {
  const squadStakingClient = await getKeplrSquadStakingClient(userId);
  const tx = await squadStakingClient.withdraw();
  return tx.transactionHash;
};

const ethereumSquadWithdraw = async (
  networkId: string,
  userAddress: string,
  squadIndex: number,
) => {
  const ethereumNetwork = mustGetEthereumNetwork(networkId);
  const signer = await getMetaMaskEthereumSigner(ethereumNetwork, userAddress);
  if (!signer) {
    throw Error(`failed to get ethereum signer`);
  }

  const squadStakingClient = SquadStakingV3__factory.connect(
    ethereumNetwork.riotSquadStakingContractAddress,
    signer,
  );

  const tx = await squadStakingClient.unstake(squadIndex);
  const receipt = await tx.wait();
  return receipt.transactionHash;
};

export const squadWithdraw = async (
  userId: string | undefined,
  squadIndex: number,
) => {
  if (!userId) return;

  const [network, userAddress] = parseUserId(userId);

  switch (network?.kind) {
    case NetworkKind.Cosmos:
      return cosmosSquadWithdraw(userId);
    case NetworkKind.Ethereum:
      return ethereumSquadWithdraw(network.id, userAddress, squadIndex);
    default:
      throw Error(`network ${network?.id} does not support withdraw squad`);
  }
};

export const estimateStakingDuration = (
  rippers: NFT[],
  squadStakingConfig: SquadConfig,
) => {
  const bonusMultiplier = squadStakingConfig.bonusMultiplier;

  let duration = 0;

  const ripperCount = rippers.length;
  if (ripperCount > 0) {
    // Get base stamina from Squad leader at slot 0
    const baseStamina = getRipperTraitValue(rippers[0], "Stamina");
    duration =
      baseStamina * SQUAD_STAKE_COEF * (bonusMultiplier[ripperCount - 1] / 100);
  }

  return duration * 60 * 60 * 1000; // Convert to milliseconds
};

export const getSquadPresetId = (
  userId: string | undefined,
  squadId: number | undefined,
) => {
  if (!userId || !squadId) return undefined;
  return `${userId}-${squadId}`;
};

const ethereumSquadStake = async (
  network: NetworkInfo,
  sender: string,
  selectedRippers: NFT[],
): Promise<string> => {
  const ethereumNetwork = mustGetEthereumNetwork(network.id);
  const squadContract = ethereumNetwork.riotSquadStakingContractAddress;

  if (!squadContract) {
    throw new Error("missing squad staking contract address in network config");
  }

  const signer = await getMetaMaskEthereumSigner(ethereumNetwork, sender);
  if (!signer) {
    throw Error("no account connected");
  }

  const selectedNfts = [];

  for (const selectedRipper of selectedRippers) {
    const tokenId = getRipperTokenId(selectedRipper);

    // Set approveForAll for each NFT contract
    const nftContractAddress = selectedRipper.nftContractAddress;
    const nftClient = TeritoriNft__factory.connect(nftContractAddress, signer);

    const isApprovedForAll = await nftClient.isApprovedForAll(
      sender,
      squadContract,
    );

    if (!isApprovedForAll) {
      const approveTx = await nftClient.setApprovalForAll(squadContract, true);
      await approveTx.wait();
    }

    selectedNfts.push({
      collection: nftContractAddress,
      tokenId,
    });
  }

  const stakeClient = SquadStakingV3__factory.connect(squadContract, signer);
  const stakeTx = await stakeClient.stake(selectedNfts);
  const res = await stakeTx.wait();

  return res.transactionHash;
};

const cosmosSquadStake = async (
  network: NetworkInfo,
  sender: string,
  selectedRippers: NFT[],
): Promise<string> => {
  const cosmosNetwork = mustGetCosmosNetwork(network.id);
  const contractAddress = cosmosNetwork.riotSquadStakingContractAddressV2;

  if (!contractAddress) {
    throw new Error("missing squad staking contract address in network config");
  }

  const client = await getKeplrSigningCosmWasmClient(network.id);

  const selectedNfts: SquadStakeNFT[] = [];
  for (const selectedRipper of selectedRippers) {
    const tokenId = getRipperTokenId(selectedRipper);

    selectedNfts.push({
      contract_addr: selectedRipper.nftContractAddress,
      token_id: tokenId,
    });
  }

  const approveMsgs = [];
  for (const selectedNft of selectedNfts) {
    const msg = buildApproveNFTMsg(
      sender,
      contractAddress,
      selectedNft.token_id,
      selectedNft.contract_addr,
    );
    approveMsgs.push(msg);
  }

  const stakeMsg = buildStakingMsg(sender, selectedNfts, contractAddress);
  const msgs = [...approveMsgs, stakeMsg];

  const tx = await client.signAndBroadcast(sender, msgs, "auto");

  if (isDeliverTxFailure(tx)) {
    throw Error(tx.transactionHash);
  }

  return tx.transactionHash;
};

export const squadStake = async (
  userId: string | undefined,
  selectedRippers: NFT[],
) => {
  const [network, sender] = parseUserId(userId);
  if (!network || !sender) {
    throw Error("invalid user id");
  }

  switch (network.kind) {
    case NetworkKind.Cosmos:
      return cosmosSquadStake(network, sender, selectedRippers);
    case NetworkKind.Ethereum:
      return ethereumSquadStake(network, sender, selectedRippers);
    default:
      throw Error(`${network.id} does not support squad stake`);
  }
};

export const estimateStakingDurationManually = async (
  userId: string,
  squadNfts: SquadNFT[],
) => {
  const [network, address] = parseUserId(userId);
  if (!network || !address) {
    return 0;
  }

  if (network.kind !== NetworkKind.Ethereum || network.id !== "polygon") {
    return 0;
  }

  const stakingConfig = await getEthereumSquadStakingConfig(network.id);

  const nftInfosPromise = squadNfts.map(async (nft) => {
    return await getEthereumStandardNFTInfo(
      network,
      network?.riotContractAddressGen0,
      nft.tokenId,
      userId,
    );
  });
  const nftInfos = await Promise.all(nftInfosPromise);
  const nftInfosToNFTs: NFT[] = nftInfos.map((nft) =>
    NFT.fromPartial({
      attributes: nft.attributes.map((attr) => ({
        traitType: attr.trait_type,
        value: attr.value,
      })),
    }),
  );

  const duration = estimateStakingDuration(nftInfosToNFTs, stakingConfig);
  return duration;
};

export const getEthereumSquadStakingConfig = async (
  networkId: string | undefined,
) => {
  const ethereumClient = await getEthereumSquadStakingQueryClient(networkId);

  const cooldownPeriod = await ethereumClient.cooldownPeriod();
  const owner = await ethereumClient.owner();
  const squadCountLimit = await ethereumClient.maxSquadCount();

  // NOTE: the current contract does not allow to retrieve the array of multiplier but individual value
  // so we hardcode several values because it will not be changed and it take too much requests to get them
  const squadConfig: SquadConfig = {
    owner,
    cooldownPeriod: cooldownPeriod.toNumber(),
    squadCountLimit: squadCountLimit.toNumber(),
    // Hardcode
    bonusMultiplier: [100, 105, 125, 131, 139, 161],
    maxSquadSize: 6,
    minSquadSize: 1,
  };

  return squadConfig;
};
