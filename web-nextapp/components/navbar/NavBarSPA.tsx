import { Flex, FlexProps, Icon } from "@chakra-ui/react";
import { FiHome, FiList, FiBarChart2, FiSettings } from "react-icons/fi";

import { LinkItemSPAProps, PagesEnum } from "../../../types";

interface NavItemProps extends FlexProps {
  item: LinkItemSPAProps;
  setPage?: (name: PagesEnum) => void;
  onClose?: () => void;
  children?: string;
}

export const NavItemSPA = ({
  item,
  children,
  onClose,
  setPage,
  ...rest
}: NavItemProps) => {
  return (
    <Flex
      w="full"
      justify="start"
      align="center"
      p="4"
      borderRadius="lg"
      role="group"
      cursor="pointer"
      _hover={{
        bg: "purple.800",
        color: "white",
      }}
      onClick={() => {
        if (setPage) setPage!(item.id);
        // if (onClose) onClose();
      }}
      {...rest}
    >
      {item.icon == 1 && (
        <Icon
          mr="4"
          fontSize="16"
          _groupHover={{
            color: "white",
          }}
          as={FiHome}
        />
      )}
      {item.icon == 2 && (
        <Icon
          mr="4"
          fontSize="16"
          _groupHover={{
            color: "white",
          }}
          as={FiList}
        />
      )}
      {item.icon == 3 && (
        <Icon
          mr="4"
          fontSize="16"
          _groupHover={{
            color: "white",
          }}
          as={FiBarChart2}
        />
      )}
      {item.icon == 4 && (
        <Icon
          mr="4"
          fontSize="16"
          _groupHover={{
            color: "white",
          }}
          as={FiSettings}
        />
      )}
      {children}
    </Flex>
  );
};
