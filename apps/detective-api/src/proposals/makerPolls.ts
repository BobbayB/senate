import { InternalServerErrorException, Logger } from "@nestjs/common";
import { DAOHandlerType, ProposalType } from "@prisma/client";
import { DAOHandler } from "@senate/common-types";
import { prisma } from "@senate/database";
import axios from "axios";
import { ethers } from "ethers";

const provider = new ethers.providers.JsonRpcProvider({
  url: String(process.env.PROVIDER_URL),
});

const logger = new Logger("MakerPolls");

export const updateMakerPolls = async (daoHandler: DAOHandler) => {

  logger.log(`Searching polls from block ${daoHandler.decoder['latestProposalBlock']} ...`)
  let proposals;

  try {
    let mkrPollVoteHandler = await prisma.dAOHandler.findFirst({
      where: {
          daoId: daoHandler.daoId,
          type: DAOHandlerType.MAKER_POLL_VOTE
      }
    })
  
    const pollingContractIface = new ethers.utils.Interface(daoHandler.decoder['abi']);
  
    const logs = await provider.getLogs({
      fromBlock: daoHandler.decoder['latestProposalBlock'],
      address: daoHandler.decoder['address'],
      topics: [pollingContractIface.getEventTopic("PollCreated")],
    });
  
    proposals = logs.map((log) => ({
      txBlock: log.blockNumber,
      txHash: log.transactionHash,
      eventData: pollingContractIface.parseLog({
        topics: log.topics,
        data: log.data,
      }).args,
    }));
  
    for (let i = 0; i < proposals.length; i++) {
      let proposalCreatedTimestamp = Number(proposals[i].eventData.blockCreated);
  
      let votingStartsTimestamp = Number(proposals[i].eventData.startDate);
      let votingEndsTimestamp = Number(proposals[i].eventData.endDate);
      let title = await getProposalTitle(proposals[i].eventData.url);
      let proposalUrl = daoHandler.decoder['proposalUrl'] + proposals[i].eventData.multiHash.substring(0, 7);
      let proposalOnChainId = Number(proposals[i].eventData.pollId).toString();
  
      // Update latest block
      let decoder = daoHandler.decoder;
      decoder['latestProposalBlock'] = proposals[i].txBlock + 1;
      await prisma.dAOHandler.update({
        where: {
          id: daoHandler.id,
        },
        data: {
          decoder: decoder,
        },
      });

      console.log(proposalOnChainId)
      await prisma.proposal.upsert({
          where: {
              externalId_daoId: {
                  daoId: daoHandler.daoId,
                  externalId: proposalOnChainId,
              },
        },
        update: {},
        create: {
          externalId: proposalOnChainId,
          name: String(title),
          daoId: daoHandler.daoId,
          daoHandlerId: mkrPollVoteHandler.id,
          proposalType: ProposalType.MAKER_POLL,
          data: {
              timeEnd: votingEndsTimestamp * 1000,
              timeStart: votingStartsTimestamp * 1000,
              timeCreated: proposalCreatedTimestamp * 1000,
          },
          url: proposalUrl,
        },
      });
    }
  } catch (err) {
    logger.log("Error while updating Maker Polls", err);
    throw new InternalServerErrorException();
  }
  

  logger.log("\n\n");
  logger.log(`Updated ${proposals.length} maker polls`);
  logger.log("======================================================\n\n");
};

const formatTitle = (text: String): String => {
  let temp = text.split("summary:")[0].split("title: ")[1];

  return temp;
};



const getProposalTitle = async (url: string): Promise<any> => {
  let title;
  try {
    const response = await axios.get(url);
    title = formatTitle(response.data);
  } catch (error) {
    title = "Unknown";
  }

  return title;
};
